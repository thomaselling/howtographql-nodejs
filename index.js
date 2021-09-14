const { ApolloServer } = require('apollo-server');
const { PrismaClient } = require('@prisma/client')

const Query = require('./resolvers/Query')
const Mutation = require('./resolvers/Mutation')
const User = require('./resolvers/User')
const Link = require('./resolvers/Link')

const depthLimit = require('graphql-depth-limit')
const complexityLimit = require('graphql-query-complexity')

const resolvers = {
  Query,
  Mutation,
  User,
  Link
}

const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient()
const { getUserId } = require('./utils');

const server = new ApolloServer({
  typeDefs: fs.readFileSync(
    path.join(__dirname, 'schema.graphql'),
    'utf8'
  ),
  resolvers,
  formatError: (err) => {
    if (err.extensions.code.includes('GRAPHQL_VALIDATION_FAILED') ||
	    err.extensions.code.includes('INTERNAL_SERVER_ERROR')) {
      return new Error('Custom Internal server error');
     }
     return err.extensions.code;
  },
  introspection: false,
  validationRules: [
    depthLimit(5),
    complexityLimit.createComplexityRule({
        estimators: [
          // Configure your estimators
          complexityLimit.simpleEstimator({ defaultComplexity: 1 }),
        ],
        maximumComplexity: 20,
        //variables,
        onComplete: (complexity = number) => {
          console.log('Query Complexity:', complexity);
        },
      }),
  ],
  context: ({ req }) => {
    return {
      ...req,
      prisma,
      userId:
        req //&& req.headers.authorization
          ? getUserId(req)
          : null
    };
  }
});

server
  .listen()
  .then(({ url }) =>
    console.log(`Server is running on ${url}`)
  );
