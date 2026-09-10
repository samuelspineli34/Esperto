export interface ReleaseInfo {
  version: string;
  tagName: string;
  name: string;
  body: string;
  publishedAt: string;
  htmlUrl: string;
  downloadUrl?: string; // Link direto para o .exe se houver
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
      throw new Error(`Erro ao verificar versão no GitHub (${res.status})`);
    }

    const data = await res.json();
    const latestTag = data.tag_name || data.name || '';
    const hasUpdate = isNewerVersion(latestTag, CURRENT_VERSION);

    // Procura por um arquivo .exe ou .msi nos assets do release para download direto opcional
    const assets = data.assets || [];
    const exeAsset = assets.find((a: any) => a.name.endsWith('.exe') || a.name.endsWith('.msi'));
    const downloadUrl = exeAsset ? exeAsset.browser_download_url : data.html_url;

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
  } catch (err) {
    console.error('Erro ao checar atualizações:', err);
    return null;
  }
}