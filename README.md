# Jardim Ritual

Jardim interativo em Three.js/WebGL. Exportação da base aprovada de 07/10/2026,
commit original `74b86d86a1876b7781eac52a6b990dc12a540504`.

## Executar localmente

Com Python 3 instalado, executar na raiz do projeto:

```sh
python -m http.server 8000 --directory dist
```

Abrir `http://localhost:8000`. Os módulos JavaScript precisam de um servidor
HTTP; não abrir `index.html` diretamente pelo sistema de arquivos.

Sem instalação de dependências ou etapa de build. Three.js e os loaders
utilizados estão em `dist/vendor`; os assets estão em `dist/assets`.

## Controles

- WASD/setas: movimentação.
- E: ritual no círculo ou vidência na margem do lago, conforme o contexto.
- V: entrar/sair do Véu, quando o estado permite.

## Publicação na Vercel

Importar o repositório GitHub privado `lucasfaustinodev/jardim-ritual`.
Configuração: Framework Other, Root Directory raiz do repositório,
Build Command vazio, Install Command vazio, Output Directory `dist`.
O `vercel.json` já contém a configuração estática.

Usar `main` como produção. Desenvolver ajustes em branches e revisar as
previews antes de integrar. A publicação anterior permanece independente.

## Organização

`dist/main.js`: composição, input e update loop.
`dist/character.js`: personagem física.
`dist/familiar.js`: familiar.
`dist/ritual.js`: ritual principal.
`dist/scrying-pond.js` e `dist/scrying-vision.js`: lago e visão dinâmica.
`dist/veil.js` e `dist/veil-wanderers.js`: projeção astral e espíritos.
`dist/README.md`: registro técnico completo das rodadas anteriores.

## Estado da transferência

Este pacote contém todos os 32 arquivos da versão aprovada sem alteração
do jogo. A criação do repositório e o deploy devem ser confirmados antes
de considerar a transferência concluída. `SOURCE_MANIFEST.json` registra
o hash de cada arquivo original para conferência.
