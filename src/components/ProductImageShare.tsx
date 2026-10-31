import React, { useState, useEffect } from 'react';
import { Copy, Download, Check, X, CheckCircle2, MessageCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, copyImageBlobToClipboard } from '../lib/utils';
import { generateProductCardCanvas } from '../utils/productCardCanvas';
import type { Product } from '../types';

interface ProductImageShareProps {
  product: Product | null;
  sellerName?: string;
  sellerPhone?: string;
  isOpen: boolean;
  onClose: () => void;
  getProductImageUrl: (photo?: string, ean?: string | number, mfg?: string, desc?: string) => string;
}

export const ProductImageShareModal: React.FC<ProductImageShareProps> = ({
  product,
  sellerName,
  sellerPhone,
  isOpen,
  onClose,
  getProductImageUrl,
}) => {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedImgUrl, setGeneratedImgUrl] = useState<string | null>(null);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Trigger generation as soon as modal opens
  useEffect(() => {
    if (!isOpen || !product) {
      setGeneratedImgUrl(null);
      setGeneratedBlob(null);
      setCopiedSuccess(false);
      setGenerationError(null);
      return;
    }

    let isMounted = true;
    setIsGenerating(true);
    setGenerationError(null);

    const imageUrl = getProductImageUrl(
      product.photo,
      product.ean,
      product.manufacturer,
      product.description
    );

    generateProductCardCanvas({
      product,
      sellerName: sellerName || 'Vendas HBN1',
      sellerPhone,
      imageUrl,
    })
      .then(async ({ blob, dataUrl }) => {
        if (!isMounted) return;

        if (blob && dataUrl) {
          setGeneratedBlob(blob);
          setGeneratedImgUrl(dataUrl);
          setIsGenerating(false);

          // Automatically copy to clipboard for quick paste in WhatsApp
          const copied = await copyImageBlobToClipboard(blob);
          if (copied && isMounted) {
            setCopiedSuccess(true);
            toast.success('🎉 Imagem copiada com sucesso! Cole no WhatsApp (Ctrl + V).', {
              duration: 5000,
            });
            setTimeout(() => {
              if (isMounted) setCopiedSuccess(false);
            }, 4000);
          }
        } else {
          throw new Error('Não foi possível gerar a imagem da oferta.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error generating product card:', err);
        setGenerationError('Falha ao renderizar imagem. Tente novamente.');
        setIsGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, product?.id]);

  if (!product || !isOpen) return null;

  const salePrice = Number(product.salePrice) || 0;
  const finalPrice = Number(product.finalPrice) || 0;
  const discountVal = Number(product.discount) || 0;
  const hasDiscount = salePrice > finalPrice && finalPrice > 0 && discountVal > 0 && discountVal < 100;
  const economy = hasDiscount ? salePrice - finalPrice : 0;
  const finalDiscount = hasDiscount ? discountVal : 0;

  const handleCopy = async () => {
    if (generatedBlob) {
      const copied = await copyImageBlobToClipboard(generatedBlob);
      if (copied) {
        setCopiedSuccess(true);
        toast.success('🎉 Imagem copiada com sucesso! Cole no WhatsApp (Ctrl + V).', {
          duration: 5000,
        });
        setTimeout(() => setCopiedSuccess(false), 4000);
        return;
      }
    }

    // If blob not yet available or clipboard blocked, re-generate and download
    setIsGenerating(true);
    try {
      const imageUrl = getProductImageUrl(
        product.photo,
        product.ean,
        product.manufacturer,
        product.description
      );

      const { blob, dataUrl } = await generateProductCardCanvas({
        product,
        sellerName: sellerName || 'Vendas HBN1',
        sellerPhone,
        imageUrl,
      });

      if (!blob || !dataUrl) throw new Error('Falha ao renderizar');

      setGeneratedBlob(blob);
      setGeneratedImgUrl(dataUrl);

      const copied = await copyImageBlobToClipboard(blob);
      if (copied) {
        setCopiedSuccess(true);
        toast.success('🎉 Imagem copiada! Cole no WhatsApp (Ctrl + V).');
        setTimeout(() => setCopiedSuccess(false), 4000);
      } else {
        toast.info('Baixando imagem da oferta para o seu aparelho...');
        handleDownload(dataUrl);
      }
    } catch (err: any) {
      toast.error('Erro ao copiar: ' + (err.message || 'Tente novamente'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (dataUrlParam?: string) => {
    const url = dataUrlParam || generatedImgUrl;
    if (!url) return;

    const link = document.createElement('a');
    const cleanName = (product.description || 'produto')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .substring(0, 30);
    link.download = `oferta_${cleanName}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Imagem salva no dispositivo!');
  };

  const handleShareWhatsApp = async () => {
    // If Web Share API with files is supported (smartphones)
    if (navigator.canShare && generatedBlob) {
      try {
        const file = new File([generatedBlob], 'oferta_produto.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: product.description,
            text: `Confira esta oferta: ${product.description} por apenas ${formatCurrency(product.finalPrice)}!`,
            files: [file],
          });
          toast.success('Compartilhado com sucesso!');
          return;
        }
      } catch (e) {
        // User cancelled or share failed, fallback to text link
      }
    }

    // Direct WhatsApp message fallback
    const message = encodeURIComponent(
      `*${product.description}*\n` +
      `Código: ${product.id} ${product.ean ? `| EAN: ${product.ean}` : ''}\n` +
      (hasDiscount ? `De: ~${formatCurrency(product.salePrice)}~ (${finalDiscount.toFixed(2)}% OFF)\n` : '') +
      `*Por apenas: ${formatCurrency(product.finalPrice)}*\n` +
      (economy > 0.01 ? `Economia de: ${formatCurrency(economy)} por unidade\n` : '') +
      `\nPeça já!`
    );

    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-800">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-100 dark:bg-orange-950/40 text-orange-600 rounded-xl shadow-xs">
              <Copy size={18} />
            </div>
            <div>
              <h3 className="font-display font-black text-base text-gray-900 dark:text-white">
                Imagem da Oferta
              </h3>
              <p className="text-xs text-gray-500">
                Pronta para copiar e colar no WhatsApp (Ctrl + V)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body: Preview of the generated image */}
        <div className="p-4 sm:p-6 space-y-4">
          {generatedImgUrl ? (
            <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-md bg-white p-1">
              <img
                src={generatedImgUrl}
                alt={product.description}
                className="w-full h-auto object-contain max-h-[380px] rounded-xl"
              />
            </div>
          ) : isGenerating ? (
            <div className="p-12 text-center bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 space-y-3">
              <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                Gerando card da oferta em alta definição...
              </p>
              <p className="text-xs text-gray-500">
                Preparando imagem com foto, preços e dados do produto
              </p>
            </div>
          ) : generationError ? (
            <div className="p-6 text-center bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-200 dark:border-red-900/40 space-y-2">
              <AlertCircle size={32} className="text-red-500 mx-auto" />
              <p className="text-xs font-bold text-red-700 dark:text-red-400">
                {generationError}
              </p>
              <button
                onClick={handleCopy}
                className="text-xs font-bold text-orange-600 underline hover:text-orange-700"
              >
                Tentar novamente
              </button>
            </div>
          ) : null}

          {/* Feedback banner */}
          {copiedSuccess && (
            <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl text-green-800 dark:text-green-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              <span>
                Imagem copiada com sucesso! Abra o <b>WhatsApp</b> e pressione <b>Ctrl + V</b> para colar.
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              disabled={isGenerating}
              className="w-full py-3.5 px-4 bg-brand-orange hover:bg-brand-orange-light active:scale-[0.98] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : copiedSuccess ? (
                <Check size={16} />
              ) : (
                <Copy size={16} />
              )}
              <span>{copiedSuccess ? 'Imagem Copiada!' : 'Copiar Imagem'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={isGenerating}
              className="w-full py-3.5 px-4 bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <MessageCircle size={16} />
              <span>Enviar no WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownload()}
              disabled={!generatedImgUrl || isGenerating}
              className="w-full sm:col-span-2 py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download size={15} />
              <span>Baixar Imagem (PNG)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
