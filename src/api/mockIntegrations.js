// Integrações mockadas para substituir Base44

const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

// Core integrations
export const Core = {
  // Invocar LLM (IA)
  InvokeLLM: async ({ prompt, model = 'gpt-4', max_tokens = 1000 }) => {
    await delay();

    console.log('Invocando LLM:', model, prompt.substring(0, 50) + '...');

    // Simula resposta de IA
    return {
      success: true,
      response: `Esta é uma resposta mockada da IA para o prompt: "${prompt.substring(0, 100)}..."`,
      model,
      tokens_used: Math.floor(Math.random() * max_tokens),
      created_at: new Date().toISOString(),
    };
  },

  // Enviar Email
  SendEmail: async ({ to, subject, body, html, from }) => {
    await delay();

    console.log('Enviando email para:', to);
    console.log('Assunto:', subject);

    return {
      success: true,
      message_id: `email-${Date.now()}`,
      to,
      subject,
      status: 'sent',
      sent_at: new Date().toISOString(),
    };
  },

  // Upload de arquivo
  UploadFile: async ({ file, folder = 'uploads' }) => {
    await delay();

    console.log('Fazendo upload de arquivo:', file.name || 'arquivo', 'para', folder);

    // Simula URL do arquivo
    const fileUrl = `https://storage.exemplo.com/${folder}/${Date.now()}-${file.name || 'file'}`;

    return {
      success: true,
      url: fileUrl,
      filename: file.name || 'file',
      size: file.size || 0,
      mime_type: file.type || 'application/octet-stream',
      uploaded_at: new Date().toISOString(),
    };
  },

  // Gerar imagem com IA
  GenerateImage: async ({ prompt, size = '1024x1024', quality = 'standard' }) => {
    await delay(1000);

    console.log('Gerando imagem com IA:', prompt);

    // Retorna placeholder
    const [width, height] = size.split('x');
    const imageUrl = `https://via.placeholder.com/${width}x${height}/0066CC/FFFFFF?text=${encodeURIComponent(prompt.substring(0, 20))}`;

    return {
      success: true,
      url: imageUrl,
      prompt,
      size,
      quality,
      created_at: new Date().toISOString(),
    };
  },

  // Extrair dados de arquivo enviado
  ExtractDataFromUploadedFile: async ({ file_url, file_type = 'pdf' }) => {
    await delay(1500);

    console.log('Extraindo dados do arquivo:', file_url);

    // Simula extração de dados
    return {
      success: true,
      extracted_data: {
        text: 'Este é o conteúdo extraído do arquivo mockado...',
        metadata: {
          pages: 3,
          word_count: 450,
          language: 'pt-BR',
        },
        tables: [],
        images: [],
      },
      file_url,
      file_type,
      extracted_at: new Date().toISOString(),
    };
  },

  // Criar URL assinada para arquivo privado
  CreateFileSignedUrl: async ({ file_path, expires_in = 3600 }) => {
    await delay(200);

    console.log('Criando URL assinada para:', file_path);

    // Simula URL assinada
    const signedUrl = `https://storage.exemplo.com/signed/${file_path}?token=mock-token-${Date.now()}&expires=${expires_in}`;

    return {
      success: true,
      signed_url: signedUrl,
      file_path,
      expires_in,
      expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
    };
  },

  // Upload de arquivo privado
  UploadPrivateFile: async ({ file, folder = 'private' }) => {
    await delay();

    console.log('Fazendo upload de arquivo privado:', file.name || 'arquivo', 'para', folder);

    // Simula caminho do arquivo
    const filePath = `${folder}/${Date.now()}-${file.name || 'file'}`;

    return {
      success: true,
      file_path: filePath,
      filename: file.name || 'file',
      size: file.size || 0,
      mime_type: file.type || 'application/octet-stream',
      uploaded_at: new Date().toISOString(),
    };
  },
};
