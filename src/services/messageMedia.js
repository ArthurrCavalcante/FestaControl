export async function hydratePrivateMessageMedia(client, messages) {
  const paths = [...new Set(messages
    .map((message) => message.media_url)
    .filter((path) => typeof path === 'string' && path && !/^https?:\/\//i.test(path)))];

  let signedUrls = {};
  if (paths.length > 0) {
    const { data, error } = await client.storage.from('crm').createSignedUrls(paths, 300);
    if (error) throw error;
    signedUrls = Object.fromEntries((data || [])
      .filter((item) => item.signedUrl)
      .map((item) => [item.path, item.signedUrl]));
  }

  return messages.map((message) => ({
    ...message,
    media_display_url: /^https?:\/\//i.test(message.media_url || '')
      ? message.media_url
      : signedUrls[message.media_url] || null,
  }));
}
