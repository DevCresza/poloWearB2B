// Integrations - Usa Supabase quando configurado, senão usa mock
import { isSupabaseConfigured } from '@/lib/supabase';
import { Core as MockCore } from './mockIntegrations';
import { supabaseIntegrations } from './supabaseIntegrations';

// Funções que usam Supabase Storage quando disponível
export const UploadFile = async (params) => {
  if (isSupabaseConfigured()) {
    return supabaseIntegrations.UploadFile(params);
  }
  return MockCore.UploadFile(params);
};

export const UploadPrivateFile = async (params) => {
  if (isSupabaseConfigured()) {
    return supabaseIntegrations.UploadPrivateFile(params);
  }
  return MockCore.UploadPrivateFile(params);
};

export const CreateFileSignedUrl = async (params) => {
  if (isSupabaseConfigured()) {
    return supabaseIntegrations.CreateFileSignedUrl(params);
  }
  return MockCore.CreateFileSignedUrl(params);
};

// Funções que ainda usam mock (não dependem de storage)
export const InvokeLLM = (params) => MockCore.InvokeLLM(params);
export const SendEmail = (params) => MockCore.SendEmail(params);
export const GenerateImage = (params) => MockCore.GenerateImage(params);
export const ExtractDataFromUploadedFile = (params) => MockCore.ExtractDataFromUploadedFile(params);

// Core export para compatibilidade
export const Core = {
  InvokeLLM,
  SendEmail,
  UploadFile,
  GenerateImage,
  ExtractDataFromUploadedFile,
  CreateFileSignedUrl,
  UploadPrivateFile,
};
