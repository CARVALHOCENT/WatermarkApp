const { app, BrowserWindow } = require('electron');
const path = require('path');

// Corrigido para carregar o 'electron-is-dev' com import() dinâmico
async function loadIsDev() {
  const { default: isDev } = await import('electron-is-dev');
  return isDev;
}

async function createWindow() {
  // Espera que o 'isDev' seja carregado
  const isDev = await loadIsDev();

  // Criar a janela do browser.
  const win = new BrowserWindow({
    width: 1100,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Carregar a aplicação de React.
  // Em desenvolvimento (dev), carrega do servidor local.
  // Em produção, carrega do 'build/index.html'.
  win.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );

  // Abrir as Ferramentas de Programação (DevTools) se estiver em modo de desenvolvimento.
  if (isDev) {
    win.webContents.openDevTools();
  }
}

// Este método é chamado quando o Electron termina a inicialização.
// A função de 'whenReady' agora pode ser 'async' para esperar pelo 'createWindow'
app.whenReady().then(async () => {
  await createWindow();
});

// Sair quando todas as janelas estão fechadas, exceto no macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});