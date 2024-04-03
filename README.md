# IMD0812-Jogos em Rede Multiusuarios
 Desenvolvimento do jogo Batalha Naval como projeto para a disciplina de jogos em rede multiusuarios

 * Em desenvolvimento

 ## Primeira etapa: Jogos simultâneos e Configurações dos tabuleiros

 * Servidor desenvolvido em NodeJS com WS;
 * Cliente desenvolvido em HTML5;
 * Para executar basta copiar a pasta do jogo, executar o servidor com o comando: 'node server.js' e abrir dois clientes no navegador na porta configurada;

### Como jogar

* Primeiramente dois jogadores devem se conectar ao servidor;
* Quando dois estiverem conectados, poderá configurar o tabuleiro individualmente da seguinte maneira:
  * Clica-se nos botões de cada navio para adicioná-lo ao tabuleiro;
  * O próprio algoritmo realiza o posicionamento de forma randômica;
  * A quantidade de cada navio está sendo informada no botão;
  * Para iniciar o jogo, todos os navios devem ser posicionados;
* Após a etapa de configuração, o jogo se inicia. Como atacar:
  * Para atacar, o jogo definirá aleatoriamente quem é o primeiro;
  * O jogador, seleciona uma das posições do tabuleiro "vazio";
  * O jogador que acertar um navio adversário pode continuar atacando até que erre;
  * Os jogadores são informados a cada ação própria e adversária;
* Fim do Jogo
  * O jogo tem seu fim quando todos os navios do adversário afundarem;
  * O jogo informa quem venceu e quem perdeu;
