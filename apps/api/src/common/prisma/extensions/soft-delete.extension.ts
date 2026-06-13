import { Prisma } from '@prisma/client';

export const softDeleteExtension = Prisma.defineExtension((client) => {
    return client.$extends({
        name: 'soft-delete',
        query: {
            user: {
                async delete({ args }) {
                    return client.user.update({
                        where: args.where,
                        data: { deletedAt: new Date() },
                    });
                },
                async deleteMany({ args }) {
                    return client.user.updateMany({
                        where: args.where,
                        data: { deletedAt: new Date() },
                    });
                },
                async findFirst({ args, query }) {
                    args.where = { deletedAt: null, ...args.where };
                    return query(args);
                },
                async findMany({ args, query }) {
                    args.where = { deletedAt: null, ...args.where };
                    return query(args);
                },
                async findUnique({ args, query }) {
                    args.where = { ...args.where, deletedAt: null };
                    return query(args);
                },
                async count({ args, query }) {
                    args.where = { deletedAt: null, ...args.where };
                    return query(args);
                },
            },
        },
    });
});

