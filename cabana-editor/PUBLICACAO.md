# Witch World — publicação principal

URL principal: https://witchworld.vercel.app/

Esta entrega substitui a entrada antiga da página principal pela cabana R3F aprovada, com o editor e o layout atual. Não publica uma rota separada de cabana. A pasta cabana-editor organiza apenas o código-fonte.

Fonte: ChatGPT Sites, versão 14, commit d72d1713f4dd8095f54710380c51b8a3967cc8f5. Os arquivos de runtime em dist são os mesmos do build aprovado, com URLs relativas de assets. O conteúdo anterior do Jardim permanece no histórico Git e os seus módulos continuam preservados; o index.html principal passa a carregar a aplicação aprovada da cabana.

O script build:publish recompila a aplicação para o diretório dist da raiz do repositório. A configuração estática da Vercel é preservada. Esta publicação não implementa novos sistemas de gameplay nem a transição entre o Jardim e a cabana.

55 testes, TypeScript e build aprovados na preparação. QA WebGL da publicação na Vercel ainda depende de conferência visual.
