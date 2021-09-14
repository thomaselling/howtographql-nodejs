const crypto = require("crypto");
const algorithm = "aes-256-cbc";
const initVector = crypto.randomBytes(16);
const Securitykey = crypto.randomBytes(32);
const gqlRateLimiter = require('graphql-rate-limit')

const cursorEncrypt = (cursor) => {
  const cipher = crypto.createCipheriv(algorithm, Securitykey, initVector);
  let encryptedData = cipher.update(cursor.toString(), "utf-8", "base64");
  encryptedData += cipher.final("base64");

  return encryptedData
}

const cursorDecrypt = (cursor) => {
  const decipher = crypto.createDecipheriv(algorithm, Securitykey, initVector);
  let decryptedData = decipher.update(cursor, "base64", "utf-8");
  decryptedData += decipher.final("utf8");

  return decryptedData
}

const rateLimiter = gqlRateLimiter.getGraphQLRateLimiter({ identifyContext: (ctx) => ctx.id });

async function feed(parent, args, context, info) {
  //const { userId } = context;
  //if (userId == null) {
  //   throw new Error(`Requires authentication - userId is ${userId}`)
  //}

  const errorMessage = await rateLimiter(
          { parent, args, context, info },
          { max: 1, window: '10s' }
        );
    if (errorMessage) throw new Error(errorMessage);

  const where = args.filter
    ? {
      OR: [
        { description: { contains: args.filter } },
        { url: { contains: args.filter } },
      ],
    }
    : {}

  const first = args.take > 2 ? 2 : args.take
  const take = Math.abs(first + 1)

  let links = []
  let hasNextPage = false
  let hasPreviousPage = false

  if (args.cursor !== undefined) {

     const oldcursor = cursorDecrypt(args.cursor)
     const skip = 1

    links = await context.prisma.link.findMany({
      where,
      skip: skip,
      take: take,
      cursor: {id: parseInt(oldcursor),},
    })

    hasPreviousPage = !!args.cursor
    hasNextPage = links.length > first
    if (hasNextPage) {
       links.pop()
    }

  } 
  else {
    links = await context.prisma.link.findMany({
      where,
      take: first,
    })
  }

  const count = await context.prisma.link.count({ where })
  hasPreviousPage = !!args.cursor
  hasNextPage = links.length < count

  const last = links[links.length - 1]
  const pageInfo = {
    hasPreviousPage,
    hasNextPage,
    startCursor: cursorEncrypt(links[0]['id']),
    endCursor: cursorEncrypt(last.id)
  }

  return {
    links,
    count,
    pageInfo,
  }
}

module.exports = {
  feed,
}
