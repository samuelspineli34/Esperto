export interface ReleaseInfo {
  version: string;
  tagName: string;
  name: string;
  body: string;
  publishedAt: string;
  htmlUrl: string;
  hasUpdate: boolean;
}

// Defina a versão atual do seu app
export const CURRENT_VERSION = 'v0.1.0';
const REPO_OWNER = 'samuelspineli34';
const REPO_NAME = 'Esperto';

// Compara semanticamente duas versões (ex: v0.1.1 > v0.1.0, mas v0.0.8 < v0.1.0)
function isNewerVersion(latest: string, current: string): boolean {
  const lParts = latest.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const cParts = current.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
    const l = lParts[i] || 0;
    const c = cParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

export async function checkForUpdates(): Promise<ReleaseInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Erro ao verificar versão (${res.status})`);
    }

    const data = await res.json();
    const latestTag = data.tag_name || data.name || '';
    const hasUpdate = isNewerVersion(latestTag, CURRENT_VERSION);

    return {
      version: latestTag.replace(/^v/, ''),
      tagName: latestTag,
      name: data.name || latestTag,
      body: data.body || 'Melhorias de desempenho e correções.',
      publishedAt: new Date(data.published_at).toLocaleDateString('pt-BR'),
      htmlUrl: data.html_url,
      hasUpdate,
    };
  } catch (err) {
    console.error('Erro ao checar atualizações:', err);
    return null;
  }
}