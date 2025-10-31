# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Vite + React application built on the Base44 platform. It's a multi-brand e-commerce management system (Polo Wear Multimarcas) with role-based access for administrators, suppliers (fornecedores), and multi-brand clients (multimarcas). The system handles products, orders, inventory, CRM, financial management, and WhatsApp integration.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Architecture

### Base44 SDK Integration

The app uses the Base44 SDK (`@base44/sdk`) as its backend. All database entities, functions, and integrations are accessed through the SDK:

- **Client Configuration**: `src/api/base44Client.js` - Creates the Base44 client with `appId: "68f7cbd8537575fa5229f1e6"` and requires authentication
- **Entities**: `src/api/entities.js` - Exports all database entities (Produto, Pedido, Fornecedor, Contact, etc.) and auth functions
- **Functions**: `src/api/functions.js` - Exports backend functions (consultarCNPJ, exportPedidosPDF, enviarWhatsApp, etc.)
- **Integrations**: `src/api/integrations.js` - Core integrations (InvokeLLM, SendEmail, UploadFile, GenerateImage, etc.)

### Routing Architecture

The routing system uses React Router with a custom structure:
- `src/pages/index.jsx` defines all routes and the `PAGES` object mapping page names to components
- `src/pages/Layout.jsx` wraps all portal pages and provides role-based navigation
- Routes follow a simple pattern: `/PageName` maps to the PageName component
- The `_getCurrentPage()` function extracts the current page from the URL

### Role-Based Access

The system has three primary user types:
- **Admin** (`user.role === 'admin'`): Full access to all features including user management, admin dashboard, and all supplier/client features
- **Fornecedor** (`user.tipo_negocio === 'fornecedor'`): Supplier view with order management and product access
- **Multimarca** (`user.tipo_negocio === 'multimarca'`): Client view with catalog browsing, cart, and order history

The Layout component (`src/pages/Layout.jsx`) handles conditional navigation rendering based on these roles.

### Page Organization

Pages are organized by functional area:
- **Admin**: UserManagement, DashboardAdmin, Admin, GestaoMetas
- **CRM**: CrmDashboard, GestaoClientes, ConfigWhatsApp
- **Products & Inventory**: GestaoProdutos, GestaoEstoque, Catalogo, GestaoCapsulas
- **Orders**: PedidosAdmin, PedidosFornecedor, MeusPedidos, CadastroCompra, Carrinho
- **Suppliers**: GestaoFornecedores
- **Financial**: CarteiraFinanceira, HistoricoCompras
- **Resources**: Recursos
- **User Profile**: MeuPerfil
- **Public**: Home, PortalDashboard

### Component Structure

```
src/
├── components/
│   ├── admin/           # Admin-specific forms and wizards (ProductForm, UserCreationWizard, etc.)
│   ├── crm/             # CRM components (ContactCard, WhatsappModal, etc.)
│   ├── estoque/         # Inventory management (MovimentacaoEstoqueForm)
│   ├── pedidos/         # Order-related components
│   ├── recursos/        # Resource components
│   └── ui/              # shadcn/ui components (Button, Card, Dialog, etc.)
├── api/                 # Base44 SDK exports
├── hooks/               # Custom React hooks
├── lib/                 # Utility libraries
├── pages/               # Page components
└── utils/               # Utility functions
```

### UI Framework

The app uses **shadcn/ui** components (configured in `components.json`):
- Style: "new-york"
- Base color: "neutral"
- Icon library: lucide-react
- No TypeScript (tsx: false)
- Path aliases configured for `@/components`, `@/lib`, `@/hooks`, etc.

Components use Radix UI primitives with Tailwind CSS styling.

### Key Data Entities

The main entities (defined in Base44 backend):
- **Produto**: Products with variants
- **Pedido**: Orders
- **Fornecedor**: Suppliers
- **Contact**: CRM contacts
- **Capsula**: Product capsules/collections
- **MovimentacaoEstoque**: Inventory movements
- **Carteira**: Financial wallet/accounts
- **Meta**: Sales targets
- **PendingUser**: Users pending approval
- **WhatsappTemplate**: WhatsApp message templates

### Authentication Flow

Authentication is handled by the Base44 SDK:
- `User.me()` checks current user
- `User.logout()` logs out
- All API operations require authentication (configured in base44Client.js)
- The Layout component checks authentication on route changes and redirects to Home if not authenticated

## Key Patterns

### Creating Forms

Forms typically use react-hook-form with zod validation. See components in `src/components/admin/` for examples like ProductForm, UserCreationWizard.

### Adding New Pages

1. Create component in `src/pages/PageName.jsx`
2. Add import and route in `src/pages/index.jsx` to the PAGES object
3. Add Route element in the Routes section
4. Add navigation link in `src/pages/Layout.jsx` with appropriate role-based rendering

### Data Fetching

Use Base44 entity methods:
```javascript
import { Produto } from '@/api/entities';

// List with filters
const produtos = await Produto.list({ filters: {...} });

// Get single item
const produto = await Produto.get(id);

// Create
const novoProduto = await Produto.create({...});

// Update
await Produto.update(id, {...});

// Delete
await Produto.delete(id);
```

### Calling Backend Functions

```javascript
import { consultarCNPJ, enviarWhatsApp } from '@/api/functions';

const resultado = await consultarCNPJ({ cnpj: '12345678901234' });
await enviarWhatsApp({ to: '5511999999999', message: 'Olá!' });
```

## Path Aliases

Vite is configured with the `@` alias pointing to `src/`:
```javascript
import { Button } from '@/components/ui/button';
import { User } from '@/api/entities';
import { createPageUrl } from '@/utils';
```

## Important Notes

- The app uses `.js` and `.jsx` extensions (not TypeScript)
- JSX support is enabled for all `.js` files in Vite config
- The project uses ESLint with React rules configured in `eslint.config.js`
- All backend operations go through the Base44 SDK - there is no direct database access
- Authentication is required for all Base44 operations
