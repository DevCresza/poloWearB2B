import React, { useState, useEffect } from 'react';
import { Capsula } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Edit, Trash2, Image, Sparkles } from 'lucide-react';
import CapsulaForm from '../components/admin/CapsulaForm';

export default function GestaoCapsulas() {
  const [capsulas, setCapsulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCapsula, setEditingCapsula] = useState(null);

  useEffect(() => {
    loadCapsulas();
  }, []);

  const loadCapsulas = async () => {
    setLoading(true);
    try {
      const capsulasList = await Capsula.list('-created_at');
      setCapsulas(capsulasList);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (capsula) => {
    setEditingCapsula(capsula);
    setShowForm(true);
  };

  const handleDelete = async (capsulaId) => {
    if (confirm('Tem certeza que deseja excluir esta cápsula?')) {
      try {
        await Capsula.delete(capsulaId);
        loadCapsulas();
      } catch (error) {
        alert('Falha ao excluir a cápsula.');
      }
    }
  };

  const handleSuccess = () => {
    setShowForm(false);
    setEditingCapsula(null);
    loadCapsulas();
  };

  return (
    <div className="bg-slate-100 p-6 rounded-3xl shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff]">
      {showForm ? (
        <CapsulaForm
          capsula={editingCapsula}
          onSuccess={handleSuccess}
          onCancel={() => {
            setShowForm(false);
            setEditingCapsula(null);
          }}
        />
      ) : (
        <Card className="bg-transparent border-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl text-gray-800">
                <Image className="w-6 h-6" />
                <span>Gestão de Cápsulas</span>
              </CardTitle>
              <CardDescription>Crie e gerencie coleções de produtos.</CardDescription>
            </div>
            <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-neumorphic-button active:shadow-neumorphic-button-inset transition-all">
              <Plus className="w-4 h-4 mr-2" />
              Nova Cápsula
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Carregando...</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {capsulas.map(capsula => (
                  <Card key={capsula.id} className="bg-slate-100 rounded-2xl shadow-[5px_5px_10px_#b8b9be,-5px_-5px_10px_#ffffff] p-4 space-y-3">
                    <div className="rounded-lg aspect-video overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100">
                      {capsula.imagem_capa_url ? (
                        <img
                          src={capsula.imagem_capa_url}
                          alt={capsula.nome}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-12 h-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg></div>';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Sparkles className="w-12 h-12 text-purple-400" />
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-lg text-gray-800">{capsula.nome}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{capsula.descricao}</p>
                    <p className="text-sm font-medium text-blue-600">{capsula.produto_ids?.length || 0} produtos</p>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(capsula)}>
                        <Edit className="w-4 h-4"/>
                      </Button>
                       <Button variant="ghost" size="icon" onClick={() => handleDelete(capsula.id)} className="text-red-500 hover:text-red-600">
                        <Trash2 className="w-4 h-4"/>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}