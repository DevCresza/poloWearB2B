import { User } from 'lucide-react';

/**
 * Componente Avatar reutilizável
 * Mostra a foto do usuário ou iniciais se não tiver foto
 *
 * @param {Object} props
 * @param {string} props.src - URL da imagem do avatar
 * @param {string} props.name - Nome do usuário para exibir iniciais
 * @param {string} props.size - Tamanho: 'sm', 'md', 'lg', 'xl' (default: 'md')
 * @param {string} props.className - Classes CSS adicionais
 * @param {function} props.onClick - Função ao clicar no avatar
 */
export default function Avatar({ src, name, size = 'md', className = '', onClick }) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl'
  };

  const getInitials = (fullName) => {
    if (!fullName) return 'U';

    const names = fullName.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }

    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  const initials = getInitials(name);
  const sizeClasses = sizes[size] || sizes.md;

  return (
    <div
      className={`rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold shadow-md ${sizeClasses} ${className} ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
      onClick={onClick}
      title={name}
    >
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Se a imagem falhar ao carregar, esconder e mostrar iniciais
            e.target.style.display = 'none';
          }}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
