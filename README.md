# LumeaPlay

App IPTV para TV (Android TV, Fire TV, TV Box, celular, LG webOS, Samsung Tizen e navegador) com ativação por **código de 9 dígitos** gerado num painel a partir do link M3U do cliente.

## Links

| O quê | Link |
|---|---|
| Baixar o APK | https://github.com/caslu1/lumeaplay/releases/latest/download/LumeaPlay.apk |
| Painel do revendedor | https://caslu1.github.io/lumeaplay/painel/ |
| App no navegador | https://caslu1.github.io/lumeaplay/tv/ |

> Os links do painel e do app no navegador precisam do GitHub Pages ligado (repositório público).

## Como funciona

1. No **painel**, você cola o link M3U do cliente, escolhe a validade e gera um código (ex.: `482-910-375`).
2. O cliente abre o **LumeaPlay** na TV e digita os 9 números.
3. O app busca o código no Supabase, confere se está ativo e no prazo, prende o código àquele aparelho e baixa a lista.
4. Canais, filmes e séries são separados automaticamente a partir da lista M3U.

No painel dá para renovar, bloquear, liberar o aparelho, editar o link e **trocar o DNS de todos os clientes de uma vez**.

## Estrutura

```
web/tv/        app de TV (HTML/CSS/JS) — o mesmo código vai dentro do APK
web/painel/    painel do revendedor (Supabase)
android/       projeto Android: WebView + player ExoPlayer (Media3)
supabase.sql   tabelas e regras de segurança do Supabase
.github/workflows/apk.yml    gera o APK a cada alteração e publica em Releases
.github/workflows/pages.yml  publica o painel e o site no GitHub Pages
```

## Configurar o Supabase (uma vez)

1. Crie um projeto em https://supabase.com (região São Paulo).
2. **SQL Editor** → cole o conteúdo de `supabase.sql`, troque `SEU_EMAIL_AQUI` pelo seu e-mail e clique em **Run**.
3. **Authentication → Users → Add user**: crie o seu login do painel (marque *Auto Confirm User*).
4. **Project Settings → API**: copie a *Project URL* e a chave *anon public* para `web/tv/js/config.js`.

## Modo demonstração

Com `demo: true` em `web/tv/js/config.js`, o código **123-456-789** abre uma lista de exemplo (sem Supabase). Mude para `false` antes de entregar aos clientes.

## Controle remoto

- Setas: navegar · OK: abrir/assistir · Voltar: voltar
- Canais: OK numa categoria abre os canais; ◀ ou Voltar retorna às categorias; ▶ mostra Assistir/Favoritar
- No player ao vivo: ▲/▼ ou CH+/CH− trocam de canal
- No player de filmes/séries: ◀/▶ voltam/avançam 10 segundos
