/* LumeaPlay — tradução para inglês (aplicada na tela inteira, sem tocar no conteúdo da lista) */
(function () {
  'use strict';
  var EN = {
    'Canais': 'Channels', 'Filmes': 'Movies', 'Séries': 'Series', 'Configurações': 'Settings',
    'Categorias': 'Categories', 'Favoritos': 'Favorites', 'Recentes': 'Recent', 'Todos os canais': 'All channels',
    'Agora no ar': 'On air now', 'A seguir': 'Up next', 'Programação': 'TV guide', 'Último canal assistido': 'Last watched channel',
    'Canais ao vivo': 'Live channels', 'AO VIVO': 'LIVE', 'Assistir': 'Watch', 'Continuar': 'Continue', 'Favoritar': 'Add to favorites',
    'Remover dos favoritos': 'Remove from favorites', 'Opções': 'Options', 'Abrir categoria': 'Open category', 'Continuar assistindo': 'Continue watching',
    'Carregando programação…': 'Loading TV guide…', 'Carregando…': 'Loading…', 'Sem programação disponível.': 'No schedule available.',
    'Este canal não tem guia de programação.': 'This channel has no TV guide.', 'Sem descrição.': 'No description.',
    'Escolha uma categoria à esquerda e aperte OK para ver os canais.': 'Pick a category on the left and press OK to see the channels.',
    'Escolha um canal para ver o que está passando e o que vem a seguir.': 'Pick a channel to see what is on now and next.',
    'Nada por aqui ainda': 'Nothing here yet', 'Nenhum canal aqui.': 'No channels here.',
    'Adicionados recentemente': 'Recently added', 'Adicionadas recentemente': 'Recently added', 'Top 10 mais recentes': 'Top 10 newest',
    'Últimas 10 adicionadas': 'Latest 10 added', 'Minha lista': 'My list', 'Da mesma categoria': 'More like this',
    'Adicionar à minha lista': 'Add to my list', 'Na minha lista': 'In my list', 'Assistir do início': 'Watch from start',
    'Temporadas': 'Seasons', 'Episódios': 'Episodes', 'Categoria': 'Category', 'Ano': 'Year', 'Qualidade': 'Quality', 'Assistido': 'Watched',
    'NOVO FILME': 'NEW MOVIE', 'NOVA SÉRIE': 'NEW SERIES', '✓ Assistido': '✓ Watched',
    'Minha conta': 'My account', 'Atualizar lista': 'Refresh list', 'Formato da tela': 'Screen format', 'Anti-travamento': 'Anti-freeze',
    'Conteúdo adulto': 'Adult content', 'Perfis': 'Profiles', 'Idioma': 'Language', 'Trocar código': 'Change code',
    'Atualizar agora': 'Refresh now', 'Trocar de perfil': 'Switch profile', 'Sair e trocar código': 'Sign out and change code', 'Mudar idioma': 'Change language',
    'Ajustar à tela': 'Fit to screen', 'Preencher (cortar bordas)': 'Fill (crop edges)', 'Esticar': 'Stretch',
    'Normal': 'Normal', 'Alto (recomendado)': 'High (recommended)', 'Máximo': 'Maximum', 'Oculto': 'Hidden', 'Visível': 'Visible',
    'Assinatura ativa': 'Active subscription', 'Assinatura vencida': 'Expired subscription', 'Sem data de vencimento': 'No expiry date',
    'dias restantes': 'days left', 'dia restante': 'day left', 'CÓDIGO DE ACESSO': 'ACCESS CODE', 'CLIENTE': 'CUSTOMER',
    'ID DO APARELHO': 'DEVICE ID', 'SUA LISTA': 'YOUR LIST', 'VERSÃO': 'VERSION', '● Ativo': '● Active', 'Este aparelho': 'This device',
    'Link M3U próprio': 'Own M3U link',
    'Baixa a lista de novo do servidor, com os canais, filmes e séries mais recentes.': 'Downloads your list again with the latest channels, movies and series.',
    'Como o vídeo ocupa a tela da sua TV.': 'How the video fills your TV screen.',
    'Guarda mais segundos de vídeo antes de tocar e reconecta sozinho quando o sinal cai. Use Máximo em internet instável.': 'Buffers more video before playing and reconnects automatically when the signal drops. Use Maximum on unstable internet.',
    'Esconde ou mostra as categorias adultas da lista.': 'Hides or shows adult categories.',
    'Sai desta conta neste aparelho. O código continua válido.': 'Signs out on this device. The code stays valid.',
    'Escolha o idioma do aplicativo.': 'Choose the app language.',
    'Quem está assistindo?': "Who's watching?", 'Escolha um perfil para continuar': 'Choose a profile to continue', 'Gerenciar perfis': 'Manage profiles',
    'Escolha um perfil para apagar': 'Choose a profile to delete', 'GERENCIAR PERFIS': 'MANAGE PROFILES', 'CONCLUÍDO': 'DONE', 'Adicionar': 'Add', 'Apagar': 'Delete',
    'Crie seu perfil': 'Create your profile', 'Novo perfil': 'New profile', 'Escolha um avatar e digite o seu nome.': 'Choose an avatar and type your name.',
    'Digite o nome do perfil': 'Type the profile name', 'Seu nome': 'Your name', 'Perfil infantil': 'Kids profile', 'Perfil padrão': 'Standard profile',
    'Espaço': 'Space', 'Limpar': 'Clear', 'Infantil: Sim': 'Kids: Yes', 'Infantil: Não': 'Kids: No', 'Digite um nome para o perfil.': 'Type a name for the profile.',
    'Escolha o idioma': 'Choose your language', 'Selecione uma opção e confirme.': 'Select an option and confirm.', 'Confirmar': 'Confirm',
    'Passo 1 de 2': 'Step 1 of 2', 'Passo 2 de 2': 'Step 2 of 2',
    'Sair do LumeaPlay?': 'Exit LumeaPlay?', 'Você pode voltar a qualquer momento.': 'You can come back anytime.', 'Sair': 'Exit', 'Cancelar': 'Cancel',
    'Trocar o código?': 'Change the code?', 'Você vai precisar digitar um código de acesso de novo.': 'You will need to enter an access code again.',
    'RESULTADOS': 'RESULTS', 'Buscar…': 'Search…', 'Busca': 'Search', 'ESPAÇO': 'SPACE', 'APAGAR': 'DELETE', 'LIMPAR': 'CLEAR',
    'Digite pelo menos 2 letras para buscar canais, filmes e séries.': 'Type at least 2 letters to search channels, movies and series.',
    'CANAL': 'CHANNEL', 'FILME': 'MOVIE', 'SÉRIE': 'SERIES', 'Série': 'Series', 'Filme': 'Movie',
    'Lista atualizada!': 'List updated!', 'Adicionado aos favoritos': 'Added to favorites', 'Removido dos favoritos': 'Removed from favorites',
    'Carregando sua lista': 'Loading your list', 'Conectando ao servidor…': 'Connecting to the server…', 'Baixando canais, filmes e séries…': 'Downloading channels, movies and series…',
    'Organizando canais, filmes e séries…': 'Organizing channels, movies and series…', 'Tudo pronto!': 'All set!', 'Verificando seu código…': 'Checking your code…',
    'Não foi possível atualizar a lista agora. Tente mais tarde.': 'Could not refresh the list now. Try again later.',
    'Não foi possível reproduzir este conteúdo.': 'Could not play this content.', 'Sem conexão com a internet. Verifique e tente de novo.': 'No internet connection. Check it and try again.',
    'Link inválido. Ele precisa começar com http:// ou https://': 'Invalid link. It must start with http:// or https://',
    'Código não encontrado. Confira os números e tente de novo.': 'Code not found. Check the numbers and try again.',
    'Este código está bloqueado. Fale com seu revendedor.': 'This code is blocked. Contact your reseller.',
    'Este código já está sendo usado em outro aparelho.': 'This code is already in use on another device.',
    'Muitas tentativas erradas. Aguarde alguns minutos e tente de novo.': 'Too many wrong attempts. Wait a few minutes and try again.',
    'O painel ainda não foi configurado. Fale com seu revendedor.': 'The panel is not set up yet. Contact your reseller.',
    'Idioma atualizado': 'Language updated', 'Language updated': 'Language updated',
    'Ativação': 'Activation', 'Ative o LumeaPlay': 'Activate LumeaPlay', 'Digite o código de 9 dígitos enviado pelo seu revendedor.': 'Enter the 9-digit code sent by your reseller.',
    'ID do aparelho': 'Device ID', 'Entrar': 'Sign in', 'Usar link M3U': 'Use M3U link', 'Receba o código de 9 dígitos do seu revendedor': 'Get the 9-digit code from your reseller',
    'Digite pelo controle remoto ou pelo teclado da tela': 'Type it with the remote or the on-screen keypad', 'Aperte Entrar e comece a assistir': 'Press Sign in and start watching',
    'Entrar com sua lista': 'Sign in with your list', 'LINK M3U': 'M3U LINK', 'Voltar': 'Back',
    'Qualidade de vídeo': 'Video quality', 'Automática (recomendado)': 'Automatic (recommended)', 'Máxima': 'Maximum', 'Ajustar (padrão)': 'Fit (default)',
    'Automática': 'Automatic', 'Manual': 'Manual', 'qualidade única': 'single quality', 'Este canal tem uma qualidade só.': 'This channel has only one quality.',
    'Como o vídeo ocupa a tela da sua TV. Ajustar mantém a proporção original, sem cortar nem esticar.': 'How the video fills your TV screen. Fit keeps the original aspect ratio, without cropping or stretching.',
    'Automática troca a qualidade sozinha conforme a sua internet, como no YouTube. Máxima trava na maior qualidade do canal. No player, a tecla vermelha, Menu ou Info troca a qualidade.': 'Automatic switches quality on its own based on your internet, like YouTube. Maximum locks the highest quality of the channel. In the player, the red, Menu or Info key changes the quality.',
    'Playback': 'Playback', 'Hoje': 'Today', 'Ontem': 'Yesterday', 'AGORA': 'NOW', '● PLAYBACK': '● PLAYBACK', 'Já passou': 'Already aired', 'Passando agora': 'On air now',
    'Assistir do início': 'Watch from start', 'Programa': 'Program', 'Como funciona': 'How it works', 'Assista ao que já passou': 'Watch what already aired',
    'Carregando canais com Playback…': 'Loading Playback channels…', 'Carregando programação…': 'Loading TV guide…', 'Sua lista não tem canais com Playback.': 'Your list has no Playback channels.',
    'Nenhum canal da sua lista oferece Playback.': 'No channel in your list offers Playback.', 'Nenhum programa gravado neste dia.': 'No recorded programs on this day.',
    'Este canal não tem programação para o Playback.': 'This channel has no Playback schedule.', 'Escolha um programa na lista para ver os detalhes.': 'Pick a program in the list to see the details.',
    'Canais com Playback guardam a programação dos últimos dias para você assistir quando quiser.': 'Playback channels keep the last days of programming so you can watch whenever you want.',
    'O Playback depende do seu servidor. Quando ele grava os canais, eles aparecem aqui automaticamente.': 'Playback depends on your server. When it records channels, they show up here automatically.',
    'Dom': 'Sun', 'Seg': 'Mon', 'Ter': 'Tue', 'Qua': 'Wed', 'Qui': 'Thu', 'Sex': 'Fri', 'Sáb': 'Sat',
    'Detalhes': 'Details', 'Navegar': 'Browse', 'Minha lista': 'My list', '★ Minha lista': '★ My list', 'Temporadas': 'Seasons', 'Episódios': 'Episodes', 'Voltar / avançar 10 s': 'Back / forward 10 s', 'Pausar / continuar': 'Pause / play', 'Trocar canal': 'Change channel', 'Informações': 'Info', 'Qualidade': 'Quality', 'Sair': 'Exit', 'Agora': 'Now', 'A seguir': 'Next',
    'Verificando seu acesso…': 'Checking your access…', 'Atualizando sua lista…': 'Refreshing your list…'
  };
  var RE = [
    [/^(\d+) canais$/, '$1 channels'], [/^(\d+) canal$/, '$1 channel'], [/^(\d+) temporadas$/, '$1 seasons'], [/^(\d+) temporada$/, '$1 season'],
    [/^(\d+) episódios$/, '$1 episodes'], [/^(\d+) canais disponíveis$/, '$1 channels available'], [/^Temporada (\d+)$/, 'Season $1'],
    [/^· Temporada (\d+)$/, '· Season $1'], [/^Episódio (\d+)$/, 'Episode $1'], [/^Temporada (\d+) • Episódio (\d+)$/, 'Season $1 • Episode $2'],
    [/^Canal (\d+)$/, 'Channel $1'], [/^Válida até (.+)$/, 'Valid until $1'], [/^Atualizada (.+)$/, 'Updated $1'], [/^Faltam (.+)$/, '$1 left'],
    [/^Continuar de (.+)$/, 'Continue from $1'], [/^Continuar T(\d+):E(\d+)$/, 'Continue S$1:E$2'], [/^Assistir T(\d+):E(\d+)$/, 'Watch S$1:E$2'],
    [/^Você parou em (.+) de (.+)\.$/, 'You stopped at $1 of $2.'], [/^Último assistido: temporada (\d+), episódio (\d+)\.$/, 'Last watched: season $1, episode $2.'],
    [/^(\d+) min$/, '$1 min'], [/^(.+) MB baixados$/, '$1 MB downloaded'], [/^FILME • (.+)$/, 'MOVIE • $1'], [/^SÉRIE • (.+)$/, 'SERIES • $1'],
    [/^(\d+) canais · (\d+) filmes · (\d+) séries$/, '$1 channels · $2 movies · $3 series'], [/^Perfil atual: (.+)\. Cada perfil tem seus favoritos e o seu "continuar assistindo"\.$/, 'Current profile: $1. Each profile has its own favorites and "continue watching".'],
    [/^(\d+) RESULTADOS$/, '$1 RESULTS'], [/^Nada encontrado para "(.*)"\.$/, 'Nothing found for "$1".'], [/^Tela: (.+)$/, 'Screen: $1'], [/^Temporada (\d+) · (\d+)$/, 'Season $1 · $2'], [/^Último assistido: temporada (\d+), episódio (\d+)\.$/, 'Last watched: season $1, episode $2.'], [/^(\d+) dias? de Playback$/, '$1 days of Playback'], [/^(\d+) programas?$/, '$1 programs'], [/^(.+) · Disponível por (\d+) dias?$/, '$1 · Available for $2 days'], [/^Qualidade: Automática$/, 'Quality: Automatic'], [/^Qualidade: (.+)$/, 'Quality: $1'], [/^Qualidade de vídeo: (.+)$/, 'Video quality: $1'], [/^(.*) · (\d+) qualidades(.*)$/, '$1 · $2 qualities$3'], [/^Perfil "(.+)" criado$/, 'Profile "$1" created'], [/^O código tem 9 números\. Faltam (\d+)\.$/, 'The code has 9 digits. $1 missing.'], [/^Muitas tentativas\. Aguarde (\d+) min e tente de novo\.$/, 'Too many attempts. Wait $1 min and try again.'], [/^Este código venceu em (.+)\. Fale com seu revendedor para renovar\.$/, 'This code expired on $1. Contact your reseller to renew.'], [/^Formato da tela: (.+)$/, 'Screen format: $1'], [/^Anti-travamento: (.+)$/, 'Anti-freeze: $1']
  ];
  var EN_UP = {}; for (var key in EN) EN_UP[key.toUpperCase()] = EN[key].toUpperCase();
  function tr(t) {
    var k = t.trim(); if (!k || k.length > 200) return null;
    var v = EN[k] || (EN_UP[k] ? EN_UP[k] : null); if (v) return t.replace(k, v);
    for (var i = 0; i < RE.length; i++) if (RE[i][0].test(k)) return t.replace(k, k.replace(RE[i][0], RE[i][1]));
    return null;
  }
  function walk(n) {
    if (n.nodeType === 3) { var r = tr(n.nodeValue); if (r !== null && r !== n.nodeValue) n.nodeValue = r; return; }
    if (n.nodeType !== 1 || n.tagName === 'SCRIPT') return;
    var w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT, null, false), x;
    while ((x = w.nextNode())) { var r2 = tr(x.nodeValue); if (r2 !== null && r2 !== x.nodeValue) x.nodeValue = r2; }
  }
  var obs = null;
  window.LumeaI18n = {
    apply: function (lang) {
      document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
      if (obs) { obs.disconnect(); obs = null; }
      if (lang !== 'en') return;
      walk(document.body);
      obs = new MutationObserver(function (ms) {
        for (var i = 0; i < ms.length; i++) {
          var m = ms[i];
          if (m.type === 'characterData') walk(m.target);
          else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
        }
      });
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  };
})();
