export interface ReleaseInfo {
  version: string;
  tagName: string;
  name: string;
  body: string;
  publishedAt: string;
  htmlUrl: string;
  hasUpdate: boolean;
}

export const CURRENT_VERSION = 'v0.1.0';
const REPO_OWNER = 'samuelspineli34';
const REPO_NAME = 'Esperto';

export async function checkForUpdates(): Promise<ReleaseInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      if (res.status === 404) return null; // Nenhuma release criada ainda
      throw new Error(`Erro ao verificar versão no GitHub (${res.status})`);
    }

    const data = await res.json();
    const latestTag = data.tag_name || data.name || '';
    
    // Compara a versão atual com a do GitHub
    const cleanCurrent = CURRENT_VERSION.replace('v', '');
    const cleanLatest = latestTag.replace('v', '');
    const hasUpdate = cleanLatest !== '' && cleanLatest !== cleanCurrent;

    return {
      version: cleanLatest,
      tagName: latestTag,
      name: data.name || latestTag,
      body: data.body || 'Correções e melhorias de desempenho.',
      publishedAt: new Date(data.published_at).toLocaleDateString('pt-BR'),
      htmlUrl: data.html_url,
      hasUpdate,
    };
  } catch (err) {
    console.error('Erro ao checar atualizações:', err);
    return null;
  }
}