import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Recurso } from '@/api/entities';
import { 
  FileText, Video, Image as ImageIcon, CheckSquare, TrendingUp,
  Download, Eye, Play, Calendar, User, X, Edit, Trash2
} from 'lucide-react';

export default function RecursoDetailsModal({ recurso, onClose, onEdit, onDelete, isAdmin }) {
  const getTipoIcon = (tipo) => {
    const icons = {
      artigo: FileText,
      video: Video,
      lookbook: ImageIcon,
      checklist: CheckSquare,
      marketing: TrendingUp,
      imagem: ImageIcon
    };
    return icons[tipo] || FileText;
  };

  const handleDelete = async () => {
    if (confirm('Tem certeza que deseja excluir este recurso?')) {
      try {
        await Recurso.delete(recurso.id);
        alert('Recurso excluído com sucesso!');
        onDelete();
      } catch (error) {
        console.error('Erro ao excluir:', error);
        alert('Erro ao excluir recurso.');
      }
    }
  };

  const TipoIcon = getTipoIcon(recurso.tipo);

  const renderConteudo = () => {
    switch (recurso.tipo) {
      case 'video':
        if (recurso.video_url) {
          let videoId = '';
          try {
            const url = new URL(recurso.video_url);
            if (url.hostname.includes('youtube.com')) {
              videoId = url.searchParams.get('v');
            } else if (url.hostname.includes('youtu.be')) {
              videoId = url.pathname.slice(1);
            }
          } catch (e) {
            console.error('URL inválida:', e);
          }

          if (videoId) {
            return (
              <div className="aspect-video rounded-lg overflow-hidden bg-black">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
                  title={recurso.titulo}
                  frameBorder="0"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                ></iframe>
              </div>
            );
          }
        }
        return (
          <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
            <Play className="w-20 h-20 text-gray-600" />
          </div>
        );

      case 'imagem':
      case 'lookbook':
        if (recurso.arquivo_url) {
          return (
            <div className="rounded-lg overflow-hidden">
              <img 
                src={recurso.arquivo_url} 
                alt={recurso.titulo}
                className="w-full h-auto"
              />
            </div>
          );
        }
        return (
          <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
            <ImageIcon className="w-20 h-20 text-gray-600" />
          </div>
        );

      case 'artigo':
        return (
          <div className="prose prose-invert max-w-none">
            <div 
              className="text-gray-300 leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: recurso.conteudo || 'Sem conteúdo disponível.' }}
            />
          </div>
        );

      case 'checklist':
        if (recurso.conteudo) {
          try {
            const items = JSON.parse(recurso.conteudo);
            return (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition">
                    <CheckSquare className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-200">{item}</span>
                  </div>
                ))}
              </div>
            );
          } catch (e) {
            return <p className="text-gray-300">{recurso.conteudo}</p>;
          }
        }
        return <p className="text-gray-500">Checklist vazio</p>;

      default:
        return <p className="text-gray-300">{recurso.conteudo || 'Sem conteúdo disponível.'}</p>;
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-black text-white border-gray-800">
        {/* Header com imagem de fundo */}
        <div className="relative -m-6 mb-6">
          {recurso.thumbnail_url && (
            <>
              <div 
                className="h-64 bg-cover bg-center"
                style={{ backgroundImage: `url(${recurso.thumbnail_url})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
            </>
          )}
          
          <div className="absolute top-4 right-4 flex gap-2">
            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(recurso)}
                  className="bg-black/50 hover:bg-black/70 text-white"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDelete}
                  className="bg-black/50 hover:bg-red-600 text-white"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="bg-black/50 hover:bg-black/70 text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="absolute bottom-4 left-6 right-6">
            <h2 className="text-4xl font-bold mb-3">{recurso.titulo}</h2>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-gray-800 text-white">
                <TipoIcon className="w-3 h-3 mr-1" />
                {recurso.tipo}
              </Badge>
              <Badge className="bg-gray-800 text-white">
                {recurso.categoria?.replace('_', ' ')}
              </Badge>
              {recurso.is_destaque && (
                <Badge className="bg-red-600 text-white">
                  ⭐ Destaque
                </Badge>
              )}
              <Badge variant="outline" className="border-gray-600 text-gray-300">
                <Eye className="w-3 h-3 mr-1" />
                {recurso.visualizacoes || 0} visualizações
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 pb-6">
          {/* Descrição */}
          {recurso.descricao && (
            <div>
              <h3 className="font-semibold text-lg mb-2 text-gray-100">Sobre</h3>
              <p className="text-gray-400">{recurso.descricao}</p>
            </div>
          )}

          <Separator className="bg-gray-800" />

          {/* Conteúdo Principal */}
          <div>
            {renderConteudo()}
          </div>

          {/* Arquivo para Download */}
          {recurso.arquivo_url && recurso.tipo !== 'video' && recurso.tipo !== 'imagem' && (
            <div className="flex items-center gap-3 p-4 bg-gray-900 rounded-lg border border-gray-800">
              <FileText className="w-8 h-8 text-blue-500" />
              <div className="flex-1">
                <p className="font-semibold text-gray-100">Arquivo disponível para download</p>
                <p className="text-sm text-gray-400">Clique no botão ao lado para fazer o download</p>
              </div>
              <Button
                variant="outline"
                onClick={() => window.open(recurso.arquivo_url, '_blank')}
                className="border-gray-700 hover:bg-gray-800"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          )}

          {/* Metadados */}
          <div className="text-sm text-gray-500 space-y-1 pt-4 border-t border-gray-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Publicado em {new Date(recurso.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
            {recurso.created_by && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>Por {recurso.created_by}</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}