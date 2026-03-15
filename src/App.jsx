import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UploadCloud, FileText, X, Loader2, Download, Trash2 } from 'lucide-react';
import { jsPDF } from 'jspdf'; // Importação para o 'npm start' local

/**
 * Função auxiliar para aplicar a marca d'água a um ficheiro de imagem.
 * @param {File} file - O ficheiro de imagem principal.
 * @param {string} watermarkImageUrl - O URL da imagem de marca d'água (criado com URL.createObjectURL).
 * @param {number} watermarkOpacity - A opacidade (0-1).
 * @param {number} watermarkWidth - A largura em píxeis.
 * @param {number} watermarkHeight - A altura em píxeis.
 * @returns {Promise<{ dataUrl: string, width: number, height: number }>}
 */
const applyWatermark = (file, watermarkImageUrl, watermarkOpacity, watermarkWidth, watermarkHeight) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    // 1. Ler o ficheiro como um Data URL
    reader.onload = (e) => {
      const img = new Image();

      // 2. Assim que a imagem é carregada num objeto Image
      img.onload = () => {
        // 3. Imagem principal carregada, carregar agora a marca d'água
        const watermarkImg = new Image();
        watermarkImg.crossOrigin = "anonymous"; // Lida com potencial CORS

        watermarkImg.onload = () => {
          // 4. Ambas as imagens estão carregadas, vamos desenhar
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;

          // 5. Desenhar imagem principal
          ctx.drawImage(img, 0, 0);

          // 6. Preparar e desenhar a marca d'água
          ctx.globalAlpha = watermarkOpacity; // Definir opacidade
          
          const margin = 10; // 10px de margem da borda
          const x = canvas.width - watermarkWidth - margin;
          const y = canvas.height - watermarkHeight - margin;

          ctx.drawImage(watermarkImg, x, y, watermarkWidth, watermarkHeight);

          // 7. Resetar o alfa
          ctx.globalAlpha = 1.0;

          // 8. Obter a imagem final como JPEG
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          resolve({ dataUrl, width: img.width, height: img.height });
        };

        watermarkImg.onerror = (err) => {
          console.error(err);
          reject(new Error('Não foi possível carregar a imagem da marca d\'água.'));
        };
        watermarkImg.src = watermarkImageUrl; // Isto aciona o watermarkImg.onload
      };

      img.onerror = (err) => {
        console.error(err);
        reject(new Error('Não foi possível carregar a imagem principal.'));
      };

      // Isto aciona o img.onload
      img.src = e.target.result;
    };

    reader.onerror = (err) => {
      console.error(err);
      reject(new Error('Não foi possível ler o ficheiro.'));
    };

    // Isto aciona o reader.onload
    reader.readAsDataURL(file);
  });
};


/**
 * O componente principal da aplicação.
 */
export default function App() {
  const [files, setFiles] = useState([]);
  const [watermarkImageUrl, setWatermarkImageUrl] = useState(null);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.5);
  const [watermarkWidth, setWatermarkWidth] = useState(100); // 100px por defeito
  const [watermarkHeight, setWatermarkHeight] = useState(100); // 100px por defeito
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const watermarkInputRef = useRef(null); // Para o seletor de ficheiro da marca d'água

  /**
   * Processa uma lista de ficheiros (do drop ou seleção)
   */
  const processFiles = useCallback((incomingFiles) => {
    const jpegFiles = Array.from(incomingFiles).filter(
      (file) => (file.type === 'image/jpeg' || file.type === 'image/jpg') && file.size > 0
    );

    if (jpegFiles.length === 0) {
      setError("Apenas ficheiros .jpeg ou .jpg são permitidos.");
    } else {
      setError(null);
    }
    setFiles(prev => [...prev, ...jpegFiles]);
  }, []);

  /**
   * Lida com a seleção do ficheiro de marca d'água
   */
  const handleWatermarkFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Se houver um URL antigo, revoga-o para libertar memória
      if (watermarkImageUrl) {
        URL.revokeObjectURL(watermarkImageUrl);
      }
      // Cria um novo URL para o ficheiro selecionado
      const newUrl = URL.createObjectURL(file);
      setWatermarkImageUrl(newUrl);
    }
  };

  /**
   * Limpa o ObjectURL quando o componente é desmontado para prevenir fugas de memória
   */
  useEffect(() => {
    // Isto corre quando o componente é desmontado
    return () => {
      if (watermarkImageUrl) {
        URL.revokeObjectURL(watermarkImageUrl);
      }
    };
  }, [watermarkImageUrl]); // Depende apenas de watermarkImageUrl

  /**
   * Lida com os eventos de drag-and-drop
   */
  const handleFileDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  /**
   * Remove um ficheiro da lista.
   */
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Limpa todos os ficheiros.
   */
  const clearFiles = () => {
    setFiles([]);
  };

  /**
   * Função principal para gerar o PDF
   */
  const handleGeneratePdf = useCallback(async () => {
    if (files.length === 0) {
      setError("Por favor, adicione pelo menos um ficheiro JPEG.");
      return;
    }
    if (!watermarkImageUrl) {
      setError("Por favor, adicione uma imagem de marca d'água.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    // --- INÍCIO DA ALTERAÇÃO ---
    // 1. Inicializar o PDF como A4, 'l' (landscape/horizontal)
    // O 'jsPDF' vem diretamente do 'import' no topo do ficheiro (linha 3)
    const doc = new jsPDF({
      orientation: 'l',
      unit: 'pt',
      format: 'a4',
    });

    // Obter as dimensões da página A4 horizontal
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    // --- FIM DA ALTERAÇÃO ---


    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Aplicar a marca d'água
        const { dataUrl } = await applyWatermark(
          file, 
          watermarkImageUrl, 
          watermarkOpacity, 
          watermarkWidth, 
          watermarkHeight
        );

        // --- INÍCIO DA ALTERAÇÃO ---
        
        // 2. Se NÃO for a primeira imagem, adicionar uma nova página A4 horizontal
        if (i > 0) {
          doc.addPage();
        }

        // 3. Adicionar a imagem ao PDF, forçando-a a preencher
        //    a página A4 horizontal (0, 0, até pageWidth, pageHeight).
        //    Isto VAI ESTICAR a imagem se ela não tiver o ratio A4.
        doc.addImage(dataUrl, 'JPEG', 0, 0, pageWidth, pageHeight);
        
        // --- FIM DA ALTERAÇÃO ---
      }

      // 4. Guardar o PDF
      doc.save('watermarked-images.pdf');
      
    } catch (err) {
      console.error(err);
      setError(`Ocorreu um erro durante o processamento: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }

  }, [files, watermarkImageUrl, watermarkOpacity, watermarkWidth, watermarkHeight]);

  // Renderizar o componente
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4 font-sans">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl p-6 md:p-8">
        
        <div className="flex items-center justify-center mb-6">
          <FileText className="w-8 h-8 text-blue-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-800">Aplicação de Marca d'Água para PDF</h1>
        </div>

        {/* --- Mensagem de Erro --- */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
            <strong className="font-bold mr-2">Ocorreu um erro:</strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* --- Definições da Marca d'Água --- */}
        <div className="mb-6 p-4 border border-gray-200 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Definições da Marca d'Água</h3>
          
          {/* Upload da Imagem da Marca d'Água */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Imagem da Marca d'Água
            </label>
            <input
              type="file"
              accept="image/png, image/jpeg, image/jpg"
              onChange={handleWatermarkFileChange}
              ref={watermarkInputRef}
              disabled={isProcessing}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {watermarkImageUrl && (
              <div className="mt-4 p-2 border rounded-lg inline-block">
                <p className="text-xs text-gray-600 mb-1">Pré-visualização da Marca d'Água:</p>
                <img 
                  src={watermarkImageUrl} 
                  alt="Watermark preview" 
                  className="h-20 w-auto object-contain bg-gray-100" 
                />
              </div>
            )}
          </div>

          {/* Dimensões da Marca d'Água */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="watermarkWidth" className="block text-sm font-medium text-gray-700 mb-1">
                Largura (px)
              </label>
              <input
                type="number"
                id="watermarkWidth"
                value={watermarkWidth}
                onChange={(e) => setWatermarkWidth(Math.max(0, Number(e.target.value)))}
                disabled={isProcessing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="watermarkHeight" className="block text-sm font-medium text-gray-700 mb-1">
                Altura (px)
              </label>
              <input
                type="number"
                id="watermarkHeight"
                value={watermarkHeight}
                onChange={(e) => setWatermarkHeight(Math.max(0, Number(e.target.value)))}
                disabled={isProcessing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Opacidade da Marca d'Água */}
          <div>
            <label htmlFor="watermarkOpacity" className="block text-sm font-medium text-gray-700 mb-1">
              Opacidade ({Math.round(watermarkOpacity * 100)}%)
            </label>
            <input
              type="range"
              id="watermarkOpacity"
              min="0"
              max="1"
              step="0.01"
              value={watermarkOpacity}
              onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
              disabled={isProcessing}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            />
          </div>

        </div>

        {/* --- Zona de Drop de Ficheiros --- */}
        <div
          onDrop={handleFileDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg transition-colors duration-200
            ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            type="file"
            accept="image/jpeg, image/jpg"
            multiple
            onChange={handleFileSelect}
            ref={fileInputRef}
            className="hidden"
            disabled={isProcessing}
          />
          <UploadCloud className="w-12 h-12 text-gray-400" />
          <p className="mt-4 text-lg font-semibold text-gray-700">Arraste e solte ficheiros JPEG aqui</p>
          <p className="mt-1 text-sm text-gray-500">ou</p>
          <button
            type="button"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            disabled={isProcessing}
            className="mt-3 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Procurar Ficheiros
          </button>
        </div>

        {/* --- Lista de Ficheiros Carregados --- */}
        {files.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium text-gray-900">Ficheiros Carregados ({files.length})</h3>
              <button
                type="button"
                onClick={clearFiles}
                disabled={isProcessing}
                className="flex items-center px-3 py-1 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Limpar Tudo
              </button>
            </div>
            <ul className="max-h-48 overflow-y-auto space-y-2 pr-2">
              {files.map((file, index) => (
                <li key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center min-w-0">
                    <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <span className="ml-3 text-sm font-medium text-gray-800 truncate" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    disabled={isProcessing}
                    className="ml-4 p-1 text-gray-400 rounded-full hover:bg-gray-200 hover:text-gray-600 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* --- Botão de Ação Principal --- */}
        <div className="mt-8">
          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={isProcessing || files.length === 0 || !watermarkImageUrl}
            className="w-full flex items-center justify-center px-6 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg shadow-lg
              hover:bg-blue-700
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              transition-all duration-200 ease-in-out
              disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                A processar...
              </>
            ) : (
              <>
                <Download className="w-6 h-6 mr-3" />
                Gerar e Descarregar PDF
              </>
            )}
          </button>
          {files.length === 0 && (
            <p className="text-center text-xs text-gray-500 mt-2">
              Por favor, adicione pelo menos um ficheiro JPEG.
            </p>
          )}
          {files.length > 0 && !watermarkImageUrl && (
             <p className="text-center text-xs text-red-500 mt-2">
              Por favor, adicione uma imagem de marca d'água.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}