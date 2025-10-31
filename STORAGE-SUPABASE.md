# Supabase Storage - Guia de Uso

## Data: 30/10/2025

---

## ✅ Storage Configurado

O Supabase Storage está ativo e pronto para armazenar imagens dos produtos!

### 📦 Bucket Criado: `produtos`

**Configurações:**
- **Nome**: produtos
- **Acesso**: Público (URLs acessíveis sem autenticação)
- **Tamanho máximo**: 50MB por arquivo
- **Tipos permitidos**: JPEG, JPG, PNG, WebP, GIF

### 🔐 Políticas de Acesso

| Operação | Permissão | Quem pode |
|----------|-----------|-----------|
| **Upload** | ✅ Permitido | Usuários autenticados |
| **Leitura** | ✅ Público | Qualquer pessoa (URLs públicas) |
| **Deletar** | ✅ Permitido | Usuários autenticados |
| **Atualizar** | ✅ Permitido | Usuários autenticados |

---

## 🚀 Como Usar

### 1. Importar os Helpers

```javascript
import {
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  getImageUrl,
  extractPathFromUrl
} from '@/lib/storageHelpers';
```

### 2. Upload de Imagem Única

```javascript
// Em um formulário de produto
const handleImageUpload = async (event) => {
  const file = event.target.files[0];

  if (!file) return;

  const result = await uploadImage(file, 'produtos');

  if (result.success) {
    console.log('✅ Upload concluído!');
    console.log('URL:', result.url);
    console.log('Path:', result.path);

    // Salvar a URL no produto
    setProduto({
      ...produto,
      foto_principal: result.url
    });
  } else {
    console.error('❌ Erro:', result.error);
    alert(result.error);
  }
};

// No JSX
<input
  type="file"
  accept="image/*"
  onChange={handleImageUpload}
/>
```

### 3. Upload de Múltiplas Imagens

```javascript
const handleMultipleUpload = async (event) => {
  const files = event.target.files;

  if (!files || files.length === 0) return;

  // Upload de todas as imagens
  const results = await uploadMultipleImages(files, 'produtos');

  // Filtrar apenas uploads bem-sucedidos
  const successfulUploads = results.filter(r => r.success);

  console.log(`✅ ${successfulUploads.length} de ${results.length} imagens enviadas`);

  // Obter URLs
  const urls = successfulUploads.map(r => r.url);

  // Salvar no produto
  setProduto({
    ...produto,
    fotos: urls
  });
};

// No JSX
<input
  type="file"
  accept="image/*"
  multiple
  onChange={handleMultipleUpload}
/>
```

### 4. Deletar Imagem

```javascript
const handleDeleteImage = async (imageUrl) => {
  // Extrair o path da URL
  const path = extractPathFromUrl(imageUrl);

  if (!path) {
    console.error('URL inválida');
    return;
  }

  const result = await deleteImage(path);

  if (result.success) {
    console.log('✅ Imagem deletada');

    // Remover do produto
    setProduto({
      ...produto,
      fotos: produto.fotos.filter(url => url !== imageUrl)
    });
  } else {
    console.error('❌ Erro ao deletar:', result.error);
  }
};
```

### 5. Exibir Imagem

```javascript
// Opção 1: Usar URL diretamente (se já tem a URL)
<img src={produto.foto_principal} alt={produto.nome} />

// Opção 2: Gerar URL a partir do path
const imageUrl = getImageUrl('produtos/imagem-123456.jpg');
<img src={imageUrl} alt={produto.nome} />
```

### 6. Galeria de Imagens

```javascript
const ImageGallery = ({ produto }) => {
  return (
    <div className="grid grid-cols-3 gap-4">
      {produto.fotos?.map((url, index) => (
        <div key={index} className="relative">
          <img
            src={url}
            alt={`${produto.nome} - ${index + 1}`}
            className="w-full h-40 object-cover rounded"
          />
          <button
            onClick={() => handleDeleteImage(url)}
            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded"
          >
            🗑️
          </button>
        </div>
      ))}
    </div>
  );
};
```

---

## 📋 Estrutura de Pastas Recomendada

```
produtos/
├── camisas/
│   ├── polo-azul-1234567890-abc.jpg
│   └── polo-branca-1234567891-def.jpg
├── calcas/
│   └── jeans-slim-1234567892-ghi.jpg
├── bermudas/
│   └── jeans-curta-1234567893-jkl.jpg
└── acessorios/
    └── bone-preto-1234567894-mno.jpg
```

**Exemplo de uso:**
```javascript
// Upload para pasta específica
await uploadImage(file, 'produtos/camisas');
await uploadImage(file, 'produtos/calcas');
```

---

## 🔄 Integração com Formulário de Produto

### Exemplo Completo

```javascript
import { useState } from 'react';
import { uploadImage, deleteImage, extractPathFromUrl } from '@/lib/storageHelpers';
import { Produto } from '@/api/entities';

const ProductForm = ({ produtoId }) => {
  const [produto, setProduto] = useState({
    nome: '',
    preco_por_peca: 0,
    fotos: [], // Array de URLs
  });
  const [uploading, setUploading] = useState(false);

  // Upload de foto principal
  const handleMainPhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);

    const result = await uploadImage(file, 'produtos');

    if (result.success) {
      // Deletar foto antiga (se existir)
      if (produto.foto_principal) {
        const oldPath = extractPathFromUrl(produto.foto_principal);
        if (oldPath) await deleteImage(oldPath);
      }

      setProduto({
        ...produto,
        foto_principal: result.url
      });
    } else {
      alert(result.error);
    }

    setUploading(false);
  };

  // Upload de galeria
  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);

    const results = await Promise.all(
      files.map(file => uploadImage(file, 'produtos'))
    );

    const successfulUploads = results.filter(r => r.success);
    const newUrls = successfulUploads.map(r => r.url);

    setProduto({
      ...produto,
      fotos: [...produto.fotos, ...newUrls]
    });

    setUploading(false);
  };

  // Remover foto da galeria
  const handleRemovePhoto = async (url) => {
    const path = extractPathFromUrl(url);
    if (path) {
      await deleteImage(path);
    }

    setProduto({
      ...produto,
      fotos: produto.fotos.filter(f => f !== url)
    });
  };

  // Salvar produto
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (produtoId) {
        await Produto.update(produtoId, produto);
      } else {
        await Produto.create(produto);
      }

      alert('Produto salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      alert('Erro ao salvar produto');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Campos básicos */}
      <input
        type="text"
        value={produto.nome}
        onChange={(e) => setProduto({ ...produto, nome: e.target.value })}
        placeholder="Nome do produto"
        required
      />

      {/* Foto Principal */}
      <div>
        <label>Foto Principal</label>
        {produto.foto_principal && (
          <img src={produto.foto_principal} alt="Preview" className="w-40 h-40 object-cover" />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleMainPhotoUpload}
          disabled={uploading}
        />
      </div>

      {/* Galeria */}
      <div>
        <label>Galeria de Fotos</label>
        <div className="grid grid-cols-4 gap-2">
          {produto.fotos?.map((url, index) => (
            <div key={index} className="relative">
              <img src={url} alt={`Foto ${index + 1}`} className="w-full h-32 object-cover" />
              <button
                type="button"
                onClick={() => handleRemovePhoto(url)}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleGalleryUpload}
          disabled={uploading}
        />
      </div>

      <button type="submit" disabled={uploading}>
        {uploading ? 'Enviando...' : 'Salvar Produto'}
      </button>
    </form>
  );
};
```

---

## 🎯 Boas Práticas

### 1. Nomes de Arquivo

✅ **Bom:**
```javascript
// Nome único gerado automaticamente
await uploadImage(file, 'produtos');
// Resultado: produtos/camisa-polo-1698765432-abc123.jpg
```

❌ **Evitar:**
```javascript
// Não use nomes fixos (pode sobrescrever)
const path = 'produtos/foto.jpg';
```

### 2. Validação Antes do Upload

```javascript
const validateImage = (file) => {
  // Tamanho máximo: 50MB
  if (file.size > 50 * 1024 * 1024) {
    return { valid: false, error: 'Arquivo muito grande (máx 50MB)' };
  }

  // Tipos permitidos
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Tipo de arquivo não permitido' };
  }

  return { valid: true };
};

// Usar antes do upload
const validation = validateImage(file);
if (!validation.valid) {
  alert(validation.error);
  return;
}
```

### 3. Cleanup ao Deletar Produto

```javascript
// Ao deletar um produto, deletar também suas imagens
const deletarProduto = async (produtoId) => {
  const produto = await Produto.get(produtoId);

  // Deletar todas as fotos
  const fotosParaDeletar = [
    produto.foto_principal,
    ...(produto.fotos || [])
  ].filter(Boolean);

  for (const url of fotosParaDeletar) {
    const path = extractPathFromUrl(url);
    if (path) {
      await deleteImage(path);
    }
  }

  // Deletar o produto
  await Produto.delete(produtoId);
};
```

### 4. Otimização de Imagens

```javascript
// Redimensionar antes do upload (usando canvas)
const resizeImage = (file, maxWidth = 1920, maxHeight = 1080) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(resolve, 'image/jpeg', 0.9);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

// Usar
const optimizedBlob = await resizeImage(file);
const optimizedFile = new File([optimizedBlob], file.name, { type: 'image/jpeg' });
await uploadImage(optimizedFile, 'produtos');
```

---

## 🔍 Troubleshooting

### Erro: "Supabase não está configurado"
**Solução**: Verifique se o arquivo `.env` existe e tem as variáveis corretas.

### Erro: "Invalid bucket"
**Solução**: O bucket 'produtos' precisa existir. Execute o SQL de criação novamente.

### Erro: "File size exceeds limit"
**Solução**: O arquivo é maior que 50MB. Comprima ou redimensione a imagem.

### Imagens não aparecem
**Solução**:
1. Verifique se a URL está correta
2. Verifique se o bucket está público
3. Verifique as políticas de acesso

---

## 📊 Estrutura no Banco de Dados

### Tabela `produtos`

```sql
-- Coluna para armazenar fotos (JSONB array)
fotos JSONB DEFAULT '[]'::jsonb

-- Exemplo de dados:
{
  "id": "uuid",
  "nome": "Camisa Polo Azul",
  "fotos": [
    "https://jbdcoftzffrppkyzdaqr.supabase.co/storage/v1/object/public/produtos/camisa-polo-1234.jpg",
    "https://jbdcoftzffrppkyzdaqr.supabase.co/storage/v1/object/public/produtos/camisa-polo-5678.jpg"
  ]
}
```

---

## 🎉 Pronto para Usar!

O Supabase Storage está configurado e pronto. Use os helpers em `src/lib/storageHelpers.js` para gerenciar suas imagens!

**URLs do Storage:**
- Bucket: `https://jbdcoftzffrppkyzdaqr.supabase.co/storage/v1/object/public/produtos/`
- Dashboard: https://supabase.com/dashboard/project/jbdcoftzffrppkyzdaqr/storage/buckets

---

**Desenvolvido por**: Claude Code
**Data**: 30/10/2025
**Projeto**: Polo Wear Multimarcas
**Supabase Project**: jbdcoftzffrppkyzdaqr
