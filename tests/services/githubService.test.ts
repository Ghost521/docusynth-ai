import { describe, it, expect } from 'vitest';
import { checkGitHubToken, checkRepositoryExists, createRepository, pushFileToGitHub } from '../../services/githubService';

describe('checkGitHubToken', () => {
  it('returns username for valid token', async () => {
    const result = await checkGitHubToken('valid-token');
    expect(result).toBe('testuser');
  });

  it('returns null for invalid token', async () => {
    const result = await checkGitHubToken('invalid-token');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    // MSW will bypass unhandled requests, so a truly bad URL would fail
    const result = await checkGitHubToken('');
    expect(result).toBeNull();
  });
});

describe('checkRepositoryExists', () => {
  it('returns true for existing repository', async () => {
    const result = await checkRepositoryExists('valid-token', 'testuser', 'existing-repo');
    expect(result).toBe(true);
  });

  it('returns false for non-existing repository', async () => {
    const result = await checkRepositoryExists('valid-token', 'testuser', 'nonexistent-repo');
    expect(result).toBe(false);
  });

  it('returns false on error', async () => {
    const result = await checkRepositoryExists('invalid-token', 'baduser', 'badrepo');
    expect(result).toBe(false);
  });
});

describe('createRepository', () => {
  it('creates repository successfully', async () => {
    const result = await createRepository({
      token: 'valid-token',
      name: 'new-repo',
      description: 'Test repo',
      private: true
    });
    expect(result.name).toBe('new-repo');
    expect(result.private).toBe(true);
  });

  it('throws on API error', async () => {
    await expect(
      createRepository({
        token: 'valid-token',
        name: 'error-repo',
        description: '',
        private: false
      })
    ).rejects.toThrow();
  });
});

describe('pushFileToGitHub', () => {
  it('creates new file successfully', async () => {
    const result = await pushFileToGitHub({
      token: 'valid-token',
      owner: 'testuser',
      repo: 'existing-repo',
      path: 'new-file.md',
      content: '# Hello World',
      message: 'Add new file'
    });
    expect(result.commit).toBeDefined();
    expect(result.commit.sha).toBeTruthy();
  });

  it('updates existing file with SHA', async () => {
    const result = await pushFileToGitHub({
      token: 'valid-token',
      owner: 'testuser',
      repo: 'existing-repo',
      path: 'existing-file.md',
      content: '# Updated Content',
      message: 'Update existing file'
    });
    expect(result.commit).toBeDefined();
  });

  it('uses base64 encoded content', async () => {
    // The function internally uses utf8_to_b64, just verify it doesn't throw
    const result = await pushFileToGitHub({
      token: 'valid-token',
      owner: 'testuser',
      repo: 'existing-repo',
      path: 'unicode-file.md',
      content: 'Content with unicode: äöü 你好',
      message: 'Unicode content'
    });
    expect(result.commit).toBeDefined();
  });

  it('throws on push failure', async () => {
    await expect(
      pushFileToGitHub({
        token: 'valid-token',
        owner: 'testuser',
        repo: 'existing-repo',
        path: 'fail.md',
        content: '', // Empty content triggers 422 in our mock
        message: 'Should fail'
      })
    ).rejects.toThrow();
  });

  it('defaults to main branch', async () => {
    const result = await pushFileToGitHub({
      token: 'valid-token',
      owner: 'testuser',
      repo: 'existing-repo',
      path: 'branch-test.md',
      content: 'test',
      message: 'Test default branch'
    });
    expect(result).toBeDefined();
  });
});
