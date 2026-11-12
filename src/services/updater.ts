import { check } from '@tauri-apps/plugin-updater';

export interface ReleaseInfo {
  version: string;
  tagName: string;
  name: string;
  body: string;
  publishedAt: string;
  htmlUrl: string;
  downloadUrl?: string;
  hasUpdate: boolean;
  installerSizeMb?: number;
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
    // 1. Tenta checar com o plugin oficial do Tauri
    try {
      const update = await check();
      if (update) {
        return {
          version: update.version,
          tagName: `v${update.version}`,
          name: `Esperto v${update.version}`,
          body: update.body || 'Atualização oficial de estabilidade e novas ferramentas.',
          publishedAt: new Date().toLocaleDateString('pt-BR'),
          htmlUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`,
          hasUpdate: true,
        };
      }
    } catch (_) {
      // Fallback para GitHub API direta
    }

    // 2. Consulta a API do GitHub Releases
    const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Erro ao consultar o GitHub (${res.status})`);
    }

    const data = await res.json();
    const latestTag = data.tag_name || data.name || '';
    const hasUpdate = isNewerVersion(latestTag, CURRENT_VERSION);

    const assets = data.assets || [];
    const installerAsset = assets.find((a: any) =>
      a.name.toLowerCase().endsWith('.exe')
    );
    const downloadUrl = installerAsset?.browser_download_url;
    const installerSizeMb = installerAsset ? Math.round(installerAsset.size / (1024 * 1024)) : undefined;

    return {
      version: latestTag.replace(/^v/, ''),
      tagName: latestTag,
      name: data.name || latestTag,
      body: data.body || 'Melhorias de desempenho, motor local e novas capacidades de imagem.',
      publishedAt: new Date(data.published_at).toLocaleDateString('pt-BR'),
      htmlUrl: data.html_url,
      downloadUrl,
      hasUpdate,
      installerSizeMb,
    };
  } catch (err) {
    console.warn('Erro ao checar atualizações:', err);
    return null;
  }
}