import test from 'node:test';
import assert from 'node:assert/strict';

test('hydrates private message paths with short-lived signed URLs', async () => {
  const module = await import('./messageMedia.js').catch(() => ({}));
  assert.equal(typeof module.hydratePrivateMessageMedia, 'function');

  const requested = [];
  const client = {
    storage: {
      from(bucket) {
        assert.equal(bucket, 'crm');
        return {
          async createSignedUrls(paths, expiresIn) {
            requested.push(paths, expiresIn);
            return {
              data: paths.map((path) => ({ path, signedUrl: `signed:${path}` })),
              error: null,
            };
          },
        };
      },
    },
  };

  const messages = await module.hydratePrivateMessageMedia(client, [
    { id: '1', media_url: 'companies/a/conversations/c/photo.jpg' },
    { id: '2', media_url: null },
  ]);

  assert.deepEqual(requested, [['companies/a/conversations/c/photo.jpg'], 300]);
  assert.equal(messages[0].media_display_url, 'signed:companies/a/conversations/c/photo.jpg');
  assert.equal(messages[1].media_display_url, null);
});
