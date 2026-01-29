import { http, HttpResponse } from 'msw';

export const handlers = [
  // GitHub API handlers
  http.get('https://api.github.com/user', ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (auth === 'token valid-token') {
      return HttpResponse.json({ login: 'testuser', id: 12345 });
    }
    return new HttpResponse(null, { status: 401 });
  }),

  http.get('https://api.github.com/repos/:owner/:repo', ({ params }) => {
    if (params.owner === 'testuser' && params.repo === 'existing-repo') {
      return HttpResponse.json({ full_name: 'testuser/existing-repo', default_branch: 'main' });
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.post('https://api.github.com/user/repos', async ({ request }) => {
    const body = await request.json() as any;
    if (body.name === 'error-repo') {
      return HttpResponse.json({ message: 'Repository creation failed' }, { status: 422 });
    }
    return HttpResponse.json({
      full_name: `testuser/${body.name}`,
      name: body.name,
      private: body.private,
      default_branch: 'main'
    }, { status: 201 });
  }),

  http.get('https://api.github.com/repos/:owner/:repo/contents/:path', ({ params }) => {
    if (params.path === 'existing-file.md') {
      return HttpResponse.json({ sha: 'abc123sha', content: '' });
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.put('https://api.github.com/repos/:owner/:repo/contents/:path', async ({ request }) => {
    const body = await request.json() as any;
    if (!body.content) {
      return HttpResponse.json({ message: 'Validation Failed' }, { status: 422 });
    }
    return HttpResponse.json({
      content: { path: body.path, sha: 'newsha456' },
      commit: { sha: 'commitsha789', message: body.message }
    });
  }),

  // Ollama handlers
  http.get('http://localhost:11434/api/tags', () => {
    return HttpResponse.json({ models: [{ name: 'llama3' }] });
  }),

  http.post('http://localhost:11434/api/create', async ({ request }) => {
    const body = await request.json() as any;
    if (body.name === 'error-model') {
      return HttpResponse.json({ error: 'Model creation failed' }, { status: 500 });
    }
    return HttpResponse.json({ status: 'success' });
  }),

  // Offline Ollama endpoint
  http.get('http://offline-ollama:11434/api/tags', () => {
    return HttpResponse.error();
  }),
];
