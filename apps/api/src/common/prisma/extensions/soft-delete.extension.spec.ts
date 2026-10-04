import { softDeleteExtension } from './soft-delete.extension';

describe('softDeleteExtension (Prisma 軟刪除擴展)', () => {
  let mockClient: any;
  let extension: any;

  beforeEach(() => {
    mockClient = {
      user: {
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $extends: jest.fn((ext) => ext),
    };
    extension = softDeleteExtension(mockClient);
  });

  it('user.delete 應被轉換為 update { deletedAt }', async () => {
    const deleteHook = extension.query.user.delete;
    const args = { where: { id: 'user-1' } };
    mockClient.user.update.mockResolvedValue({ id: 'user-1', deletedAt: new Date() });

    await deleteHook({ args });

    expect(mockClient.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('user.deleteMany 應被轉換為 updateMany { deletedAt }', async () => {
    const deleteManyHook = extension.query.user.deleteMany;
    const args = { where: { role: 'BANNED' } };
    mockClient.user.updateMany.mockResolvedValue({ count: 2 });

    await deleteManyHook({ args });

    expect(mockClient.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: 'BANNED' },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('user.findMany 應自動過濾 deletedAt: null 並 omit password', async () => {
    const findManyHook = extension.query.user.findMany;
    const queryMock = jest.fn().mockResolvedValue([{ id: 'user-1' }]);
    const args: any = { where: { role: 'USER' } };

    await findManyHook({ args, query: queryMock });

    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: 'USER', deletedAt: null },
        omit: expect.objectContaining({ password: true }),
      }),
    );
  });

  it('user.findUnique 應自動過濾 deletedAt: null 並 omit password', async () => {
    const findUniqueHook = extension.query.user.findUnique;
    const queryMock = jest.fn().mockResolvedValue({ id: 'user-1' });
    const args: any = { where: { email: 'test@example.com' } };

    await findUniqueHook({ args, query: queryMock });

    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'test@example.com', deletedAt: null },
        omit: expect.objectContaining({ password: true }),
      }),
    );
  });
});
