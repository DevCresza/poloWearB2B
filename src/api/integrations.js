// Integrations - Substituído por dados mockados

import { Core } from './mockIntegrations';

export { Core };

// Re-exportando funções individuais para compatibilidade
export const InvokeLLM = (params) => Core.InvokeLLM(params);
export const SendEmail = (params) => Core.SendEmail(params);
export const UploadFile = (params) => Core.UploadFile(params);
export const GenerateImage = (params) => Core.GenerateImage(params);
export const ExtractDataFromUploadedFile = (params) => Core.ExtractDataFromUploadedFile(params);
export const CreateFileSignedUrl = (params) => Core.CreateFileSignedUrl(params);
export const UploadPrivateFile = (params) => Core.UploadPrivateFile(params);
