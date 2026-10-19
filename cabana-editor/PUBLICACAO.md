# Cabana R3F publicada na Vercel

Fonte: ChatGPT Sites, versão 14, commit d72d1713f4dd8095f54710380c51b8a3967cc8f5.

URL: https://witchworld.vercel.app/cabana-editor/

O Jardim existente continua na raiz. A cabana tem aplicação e Canvas próprios, sem integrar nem substituir o loop do Jardim.

O código, os assets e os testes desta pasta correspondem à cabana aprovada. `build:publish` gera exclusivamente `../dist/cabana-editor`, usando base absoluta para os assets funcionarem com ou sem barra final na URL. A Vercel continua servindo o diretório `dist` sem instalar dependências na raiz.

Validação visual da cabana feita pelo usuário no Sites; QA WebGL da transferência para Vercel ainda deve ser conferido no navegador.
