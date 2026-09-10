export interface ReleaseInfo {
  version: string;
  tagName: string;
  name: string;
  body: string;
  publishedAt: string;
  htmlUrl: string;
  downloadUrl?: string;
  hasUpdate: boolean;
}

export const CURRENT_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v0.1.0';
const REPO_OWNER = 'samuelspineli34';
const REPO_NAME = 'Esperto';

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
      throw new Error(`Erro ao consultar o GitHub (${res.status})`);
    }

    const data = await res.json();
    const latestTag = data.tag_name || data.name || '';
    const hasUpdate = isNewerVersion(latestTag, CURRENT_VERSION);

    // Procura por um arquivo .exe ou instalador nos assets do release
    const assets = data.assets || [];
    const installerAsset = assets.find((a: any) => a.name.endsWith('.exe') || a.name.endsWith('.msi') || a.name.endsWith('.zip'));
    const downloadUrl = installerAsset ? installerAsset.browser_download_url : data.html_url;

    return {
      version: latestTag.replace(/^v/, ''),
      tagName: latestTag,
      name: data.name || latestTag,
      body: data.body || 'Melhorias de desempenho e correções.',
      publishedAt: new Date(data.published_at).toLocaleDateString('pt-BR'),
      htmlUrl: data.html_url,
      downloadUrl,
      hasUpdate,
    };
  } catch (err: any) {
    console.warn('Erro ao checar atualizações no GitHub:', err);
    return null;
  }
}