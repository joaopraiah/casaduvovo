(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // demo/shims/node-sqlite.js
  var require_node_sqlite = __commonJS({
    "demo/shims/node-sqlite.js"(exports, module) {
      var SQL = null;
      var bytesIniciais = null;
      function preparar2(sql, bytes) {
        SQL = sql;
        bytesIniciais = bytes;
      }
      var normalizar = (p) => p.map((v) => v === void 0 ? null : typeof v === "boolean" ? Number(v) : v);
      var Declaracao = class {
        constructor(db2, sql) {
          this.db = db2;
          this.sql = sql;
        }
        all(...p) {
          const s = this.db.prepare(this.sql);
          try {
            s.bind(normalizar(p));
            const linhas = [];
            while (s.step()) linhas.push(s.getAsObject());
            return linhas;
          } finally {
            s.free();
          }
        }
        get(...p) {
          return this.all(...p)[0];
        }
        run(...p) {
          this.db.run(this.sql, normalizar(p));
          const changes = this.db.getRowsModified();
          const lastInsertRowid = this.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
          return { changes, lastInsertRowid };
        }
      };
      var DatabaseSync = class {
        constructor() {
          this.db = bytesIniciais ? new SQL.Database(bytesIniciais) : new SQL.Database();
        }
        exec(sql) {
          this.db.exec(sql);
        }
        prepare(sql) {
          return new Declaracao(this.db, sql);
        }
        exportar() {
          return this.db.export();
        }
      };
      module.exports = { DatabaseSync, preparar: preparar2 };
    }
  });

  // demo/shims/path-fs.js
  var require_path_fs = __commonJS({
    "demo/shims/path-fs.js"(exports, module) {
      module.exports = {
        join: (...p) => p.join("/"),
        dirname: (p) => String(p).split("/").slice(0, -1).join("/") || "/",
        mkdirSync() {
        }
      };
    }
  });

  // demo/shims/crypto.js
  var require_crypto = __commonJS({
    "demo/shims/crypto.js"(exports, module) {
      var Bytes = class extends Uint8Array {
        toString(cod) {
          if (cod !== "hex") return super.toString();
          return Array.from(this, (b) => b.toString(16).padStart(2, "0")).join("");
        }
      };
      function randomBytes(n) {
        return crypto.getRandomValues(new Bytes(n));
      }
      function scryptSync(senha, sal, tamanho) {
        const s = String(senha) + ":" + String(sal);
        const saida = new Bytes(tamanho);
        let h = 2166136261;
        for (let i = 0; i < tamanho; i++) {
          for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k) ^ i, 16777619);
          saida[i] = h & 255;
        }
        return saida;
      }
      function timingSafeEqual(a, b) {
        if (a.length !== b.length) return false;
        let dif = 0;
        for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
        return dif === 0;
      }
      globalThis.Buffer = {
        from(hex) {
          return new Bytes((String(hex).match(/../g) || []).map((p) => parseInt(p, 16)));
        }
      };
      module.exports = { randomBytes, scryptSync, timingSafeEqual };
    }
  });

  // server/db.js
  var require_db = __commonJS({
    "server/db.js"(exports, module) {
      var { DatabaseSync } = require_node_sqlite();
      var path = require_path_fs();
      var fs = require_path_fs();
      var crypto2 = require_crypto();
      function abrir2(arquivo) {
        if (arquivo !== ":memory:") fs.mkdirSync(path.dirname(arquivo), { recursive: true });
        const db2 = new DatabaseSync(arquivo);
        db2.exec("PRAGMA journal_mode = WAL;");
        atualizarComandasAntigas(db2);
        db2.exec("PRAGMA foreign_keys = ON;");
        criarTabelas(db2);
        semear(db2);
        return db2;
      }
      function criarTabelas(db2) {
        db2.exec(`
    CREATE TABLE IF NOT EXISTS config (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY,
      nome TEXT NOT NULL,
      papel TEXT NOT NULL CHECK (papel IN ('dono','atendente','patio')),
      pin_hash TEXT NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS sessoes (
      token TEXT PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      criada_em TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS espacos (
      id INTEGER PRIMARY KEY,
      nome TEXT NOT NULL,
      ordem INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS mesas (
      id INTEGER PRIMARY KEY,
      numero TEXT NOT NULL,
      espaco_id INTEGER NOT NULL REFERENCES espacos(id),
      lugares INTEGER NOT NULL DEFAULT 4,
      ativa INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS dias (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL UNIQUE,
      troco_inicial INTEGER NOT NULL DEFAULT 0,
      maquininha_informado INTEGER,
      dinheiro_contado INTEGER,
      fechado_em TEXT,
      fechado_por TEXT
    );
    CREATE TABLE IF NOT EXISTS reservas (
      id INTEGER PRIMARY KEY,
      dia_id INTEGER NOT NULL REFERENCES dias(id),
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'familia' CHECK (tipo IN ('familia','evento')),
      adultos INTEGER NOT NULL DEFAULT 0,
      criancas INTEGER NOT NULL DEFAULT 0,
      menores INTEGER NOT NULL DEFAULT 0,
      telefone TEXT,
      obs TEXT,
      status TEXT NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando','chegou','faltou','cancelada')),
      chegou_em TEXT
    );
    CREATE TABLE IF NOT EXISTS reserva_mesas (
      reserva_id INTEGER NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
      mesa_id INTEGER NOT NULL REFERENCES mesas(id),
      PRIMARY KEY (reserva_id, mesa_id)
    );
    -- Uma comanda \xE9 um grupo que entrou. "numero" \xE9 o n\xFAmero da comanda de papel entregue na porta.
    -- *_entrada guarda quantos entraram (n\xE3o muda); adultos/criancas/menores \xE9 o que vai ser cobrado.
    -- A confer\xEAncia do fim do dia compara os dois.
    CREATE TABLE IF NOT EXISTS comandas (
      id INTEGER PRIMARY KEY,
      dia_id INTEGER NOT NULL REFERENCES dias(id),
      numero TEXT NOT NULL,
      reserva_id INTEGER REFERENCES reservas(id),
      nome TEXT NOT NULL DEFAULT '',
      adultos_entrada INTEGER NOT NULL DEFAULT 0,
      criancas_entrada INTEGER NOT NULL DEFAULT 0,
      menores_entrada INTEGER NOT NULL DEFAULT 0,
      adultos INTEGER NOT NULL DEFAULT 0,
      criancas INTEGER NOT NULL DEFAULT 0,
      menores INTEGER NOT NULL DEFAULT 0,
      desconto INTEGER NOT NULL DEFAULT 0,
      desconto_motivo TEXT,
      desconto_autorizado_por TEXT,
      status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','fechada','nao_pago')),
      motivo_nao_pago TEXT,
      registrada_por TEXT NOT NULL DEFAULT '',
      aberta_em TEXT NOT NULL,
      fechada_em TEXT
    );
    CREATE TABLE IF NOT EXISTS comanda_mesas (
      comanda_id INTEGER NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
      mesa_id INTEGER NOT NULL REFERENCES mesas(id),
      PRIMARY KEY (comanda_id, mesa_id)
    );
    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      cliente TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('cortesia','percentual','valor')),
      valor INTEGER NOT NULL,
      motivo TEXT,
      validade TEXT,
      usos_max INTEGER NOT NULL DEFAULT 1,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_por TEXT NOT NULL,
      criado_em TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS comanda_vouchers (
      comanda_id INTEGER NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
      voucher_id INTEGER NOT NULL REFERENCES vouchers(id),
      PRIMARY KEY (comanda_id, voucher_id)
    );
    CREATE TABLE IF NOT EXISTS pagamentos (
      id INTEGER PRIMARY KEY,
      comanda_id INTEGER NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
      forma TEXT NOT NULL CHECK (forma IN ('pix','cartao','dinheiro')),
      valor INTEGER NOT NULL,
      por TEXT NOT NULL,
      em TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mesa_estado (
      dia_id INTEGER NOT NULL REFERENCES dias(id),
      mesa_id INTEGER NOT NULL REFERENCES mesas(id),
      limpando INTEGER NOT NULL DEFAULT 0,
      alerta TEXT,
      PRIMARY KEY (dia_id, mesa_id)
    );
    CREATE TABLE IF NOT EXISTS caixa_movimentos (
      id INTEGER PRIMARY KEY,
      dia_id INTEGER NOT NULL REFERENCES dias(id),
      tipo TEXT NOT NULL CHECK (tipo IN ('retirada','reposicao')),
      valor INTEGER NOT NULL,
      motivo TEXT NOT NULL,
      quem TEXT NOT NULL,
      registrado_por TEXT NOT NULL,
      em TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ocorrencias (
      id INTEGER PRIMARY KEY,
      dia_id INTEGER NOT NULL REFERENCES dias(id),
      categoria TEXT NOT NULL,
      texto TEXT NOT NULL,
      mesa_id INTEGER REFERENCES mesas(id),
      por TEXT NOT NULL,
      em TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS historico (
      id INTEGER PRIMARY KEY,
      dia_id INTEGER REFERENCES dias(id),
      usuario TEXT NOT NULL,
      acao TEXT NOT NULL,
      detalhe TEXT,
      em TEXT NOT NULL
    );
  `);
      }
      function atualizarComandasAntigas(db2) {
        const colunas = db2.prepare("PRAGMA table_info(comandas)").all().map((c) => c.name);
        if (!colunas.length || colunas.includes("numero")) return;
        db2.exec("PRAGMA foreign_keys = OFF; PRAGMA legacy_alter_table = ON");
        db2.exec("BEGIN");
        try {
          db2.exec("ALTER TABLE comandas RENAME TO comandas_v1");
          criarTabelas(db2);
          db2.exec(`
      INSERT INTO comandas (id, dia_id, numero, reserva_id, nome, adultos_entrada, criancas_entrada, menores_entrada,
                            adultos, criancas, menores, desconto, desconto_motivo, desconto_autorizado_por,
                            status, aberta_em, fechada_em)
      SELECT id, dia_id, CAST(id AS TEXT), reserva_id, nome, adultos, criancas, menores,
             adultos, criancas, menores, desconto, desconto_motivo, desconto_autorizado_por,
             status, aberta_em, fechada_em
      FROM comandas_v1;
      DROP TABLE comandas_v1;`);
          db2.exec("COMMIT");
        } catch (e) {
          db2.exec("ROLLBACK");
          throw e;
        } finally {
          db2.exec("PRAGMA legacy_alter_table = OFF");
        }
      }
      function hashPin(pin) {
        const sal = crypto2.randomBytes(8).toString("hex");
        return sal + ":" + crypto2.scryptSync(String(pin), sal, 32).toString("hex");
      }
      function conferePin(pin, hash) {
        const [sal, h] = hash.split(":");
        const calc = crypto2.scryptSync(String(pin), sal, 32);
        return crypto2.timingSafeEqual(calc, Buffer.from(h, "hex"));
      }
      function semear(db2) {
        const jaTem = db2.prepare("SELECT COUNT(*) n FROM usuarios").get().n;
        if (jaTem) return;
        const precos = { adulto: 5500, crianca: 3e3, menor: 0 };
        db2.prepare("INSERT INTO config (chave, valor) VALUES (?, ?)").run("precos", JSON.stringify(precos));
        const insUsuario = db2.prepare("INSERT INTO usuarios (nome, papel, pin_hash) VALUES (?, ?, ?)");
        insUsuario.run("Dono", "dono", hashPin("1234"));
        insUsuario.run("Julliana", "atendente", hashPin("1111"));
        insUsuario.run("P\xE1tio", "patio", hashPin("2222"));
        const espacos = [
          ["P\xE1tio", 8],
          ["Jaqueira", 6],
          ["VIP Aberta", 6],
          ["Espa\xE7o dos fundos", 6],
          ["VIP Barrac\xE3o", 8]
        ];
        const insEspaco = db2.prepare("INSERT INTO espacos (nome, ordem) VALUES (?, ?)");
        const insMesa = db2.prepare("INSERT INTO mesas (numero, espaco_id, lugares) VALUES (?, ?, ?)");
        let numero = 1;
        espacos.forEach(([nome, qtd], i) => {
          const { lastInsertRowid } = insEspaco.run(nome, i);
          for (let k = 0; k < qtd; k++) insMesa.run(String(numero++), lastInsertRowid, 6);
        });
      }
      module.exports = { abrir: abrir2, hashPin, conferePin };
    }
  });

  // demo/shims/express.js
  var require_express = __commonJS({
    "demo/shims/express.js"(exports, module) {
      function casarCaminho(padrao, caminho, prefixo) {
        if (prefixo) return caminho === padrao || caminho.startsWith(padrao + "/") || padrao === "" ? {} : null;
        const a = padrao.split("/"), b = caminho.split("/");
        if (a.length !== b.length) return null;
        const params = {};
        for (let i = 0; i < a.length; i++) {
          if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
          else if (a[i] !== b[i]) return null;
        }
        return params;
      }
      function express() {
        const camadas = [];
        const adicionar = (metodo, caminho, fns, prefixo) => {
          for (const fn of fns.flat()) camadas.push({ metodo, caminho, fn, prefixo });
        };
        const app2 = {
          use(a, ...fns) {
            if (typeof a === "string") adicionar(null, a, fns, true);
            else adicionar(null, "", [a, ...fns], true);
          },
          handle(req, res) {
            let i = 0;
            const next = (err) => {
              while (i < camadas.length) {
                const c = camadas[i++];
                if (c.metodo && c.metodo !== req.method) continue;
                const params = casarCaminho(c.caminho, req.path, c.prefixo);
                if (!params) continue;
                const deErro = c.fn.length === 4;
                if (Boolean(err) !== deErro) continue;
                if (!c.prefixo) req.params = params;
                try {
                  if (err) c.fn(err, req, res, next);
                  else c.fn(req, res, next);
                } catch (e) {
                  next(e);
                }
                return;
              }
            };
            next();
          }
        };
        for (const m of ["get", "post", "put", "delete"]) {
          app2[m] = (caminho, ...fns) => adicionar(m.toUpperCase(), caminho, fns, false);
        }
        return app2;
      }
      var passa = () => (req, res, next) => next();
      express.json = passa;
      express.static = passa;
      module.exports = express;
    }
  });

  // server/calculo.js
  var require_calculo = __commonJS({
    "server/calculo.js"(exports, module) {
      function subtotal(comanda, precos) {
        return comanda.adultos * precos.adulto + comanda.criancas * precos.crianca + comanda.menores * precos.menor;
      }
      function descontoVoucher(voucher, comanda, precos) {
        const base = subtotal(comanda, precos);
        if (voucher.tipo === "percentual") return Math.round(base * voucher.valor / 100);
        if (voucher.tipo === "valor") return voucher.valor;
        let pessoas = voucher.valor;
        const adultos = Math.min(pessoas, comanda.adultos);
        pessoas -= adultos;
        const criancas = Math.min(pessoas, comanda.criancas);
        return adultos * precos.adulto + criancas * precos.crianca;
      }
      function totais(comanda, vouchers, pagamentos, precos) {
        const bruto = subtotal(comanda, precos);
        const itensVoucher = vouchers.map((v) => ({ ...v, abatido: descontoVoucher(v, comanda, precos) }));
        const somaDescontos = itensVoucher.reduce((s, v) => s + v.abatido, 0) + (comanda.desconto || 0);
        const descontos = Math.min(somaDescontos, bruto);
        const total = bruto - descontos;
        const pago = pagamentos.reduce((s, p) => s + p.valor, 0);
        return { bruto, descontos, total, pago, falta: total - pago, vouchers: itensVoucher };
      }
      module.exports = { subtotal, descontoVoucher, totais };
    }
  });

  // server/app.js
  var require_app = __commonJS({
    "server/app.js"(exports, module) {
      var express = require_express();
      var crypto2 = require_crypto();
      var path = require_path_fs();
      var { hashPin, conferePin } = require_db();
      var { totais } = require_calculo();
      var FUSO = "America/Sao_Paulo";
      var FORMAS = ["pix", "cartao", "dinheiro"];
      var NOME_FORMA = { pix: "Pix", cartao: "Cart\xE3o", dinheiro: "Dinheiro" };
      var ErroHttp = class extends Error {
        constructor(status, mensagem) {
          super(mensagem);
          this.status = status;
        }
      };
      var erro = (status, mensagem) => new ErroHttp(status, mensagem);
      function hoje2() {
        return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(/* @__PURE__ */ new Date());
      }
      var agora = () => (/* @__PURE__ */ new Date()).toISOString();
      function inteiro(v, nome, { min = 0, max = 1e8 } = {}) {
        const n = Number(v ?? 0);
        if (!Number.isInteger(n) || n < min || n > max) throw erro(400, `Valor inv\xE1lido em "${nome}".`);
        return n;
      }
      function texto(v, nome, { obrigatorio = false, max = 300 } = {}) {
        const s = String(v ?? "").trim();
        if (obrigatorio && !s) throw erro(400, `Preencha "${nome}".`);
        if (s.length > max) throw erro(400, `"${nome}" est\xE1 muito longo.`);
        return s;
      }
      function dataValida(v) {
        const s = v ? String(v) : hoje2();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw erro(400, "Data inv\xE1lida.");
        return s;
      }
      var reais = (c) => "R$ " + (c / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      function criarApp2(db2) {
        const app2 = express();
        app2.use(express.json({ limit: "1mb" }));
        app2.use(express.static(path.join("/", "..", "public")));
        const q = (sql, ...p) => db2.prepare(sql).all(...p);
        const um = (sql, ...p) => db2.prepare(sql).get(...p);
        const run = (sql, ...p) => db2.prepare(sql).run(...p);
        function tx(fn) {
          db2.exec("BEGIN");
          try {
            const r = fn();
            db2.exec("COMMIT");
            return r;
          } catch (e) {
            db2.exec("ROLLBACK");
            throw e;
          }
        }
        function precos() {
          return JSON.parse(um("SELECT valor FROM config WHERE chave = 'precos'").valor);
        }
        function dia(data) {
          let d = um("SELECT * FROM dias WHERE data = ?", data);
          if (!d) {
            run("INSERT INTO dias (data) VALUES (?)", data);
            d = um("SELECT * FROM dias WHERE data = ?", data);
          }
          return d;
        }
        function diaAberto(data) {
          const d = dia(data);
          if (d.fechado_em) throw erro(409, "O caixa deste dia j\xE1 foi fechado. Pe\xE7a ao dono para reabrir.");
          return d;
        }
        function registrar(diaId, usuario, acao, detalhe = "") {
          run(
            "INSERT INTO historico (dia_id, usuario, acao, detalhe, em) VALUES (?, ?, ?, ?, ?)",
            diaId,
            usuario.nome,
            acao,
            detalhe,
            agora()
          );
        }
        const clientes = /* @__PURE__ */ new Set();
        function avisar(data) {
          const msg = `data: ${JSON.stringify({ data })}

`;
          for (const res of clientes) res.write(msg);
        }
        const ping = setInterval(() => {
          for (const res of clientes) res.write(": ping\n\n");
        }, 25e3);
        app2.get("/api/usuarios-login", (req, res) => {
          res.json(q("SELECT id, nome, papel FROM usuarios WHERE ativo = 1 ORDER BY id"));
        });
        app2.post("/api/login", (req, res) => {
          const u = um("SELECT * FROM usuarios WHERE id = ? AND ativo = 1", inteiro(req.body.usuario_id, "usu\xE1rio"));
          if (!u || !conferePin(texto(req.body.pin, "PIN"), u.pin_hash)) throw erro(401, "PIN incorreto.");
          const token = crypto2.randomBytes(24).toString("hex");
          run("INSERT INTO sessoes (token, usuario_id, criada_em) VALUES (?, ?, ?)", token, u.id, agora());
          res.json({ token, usuario: { id: u.id, nome: u.nome, papel: u.papel } });
        });
        app2.use("/api", (req, res, next) => {
          const cab = req.get("authorization") || "";
          const token = cab.startsWith("Bearer ") ? cab.slice(7) : req.query.token;
          const u = token && um(`SELECT u.id, u.nome, u.papel FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
                           WHERE s.token = ? AND u.ativo = 1`, token);
          if (!u) return res.status(401).json({ erro: "Entre novamente." });
          req.usuario = u;
          next();
        });
        const exige = (...papeis) => (req, res, next) => {
          if (!papeis.includes(req.usuario.papel)) return res.status(403).json({ erro: "Sem permiss\xE3o para isso." });
          next();
        };
        const SALAO = exige("dono", "atendente", "patio");
        const CAIXA = exige("dono", "atendente");
        const DONO = exige("dono");
        function autorizacaoDono(req) {
          if (req.usuario.papel === "dono") return req.usuario.nome;
          const pin = String(req.body.pin_dono || "");
          if (!pin) throw erro(403, "Precisa da autoriza\xE7\xE3o de um dono (PIN).");
          const dono = q("SELECT * FROM usuarios WHERE papel = 'dono' AND ativo = 1").find((d) => conferePin(pin, d.pin_hash));
          if (!dono) throw erro(403, "PIN de dono incorreto.");
          return dono.nome;
        }
        app2.post("/api/sair", (req, res) => {
          run("DELETE FROM sessoes WHERE token = ?", (req.get("authorization") || "").slice(7));
          res.json({ ok: true });
        });
        app2.get("/api/eventos", (req, res) => {
          res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
          res.flushHeaders();
          res.write(": conectado\n\n");
          clientes.add(res);
          req.on("close", () => clientes.delete(res));
        });
        function comandaCompleta(c, p) {
          const vouchers = q(`SELECT v.* FROM comanda_vouchers cv JOIN vouchers v ON v.id = cv.voucher_id
                        WHERE cv.comanda_id = ?`, c.id);
          const pagamentos = q("SELECT * FROM pagamentos WHERE comanda_id = ? ORDER BY id", c.id);
          const mesas = q("SELECT mesa_id FROM comanda_mesas WHERE comanda_id = ?", c.id).map((r) => r.mesa_id);
          return { ...c, mesas, pagamentos, ...totais(c, vouchers, pagamentos, p) };
        }
        function resumoCaixa(d, comandas, movimentos) {
          const porForma = { pix: 0, cartao: 0, dinheiro: 0 };
          let pessoas = { adultos: 0, criancas: 0, menores: 0 };
          let descontos = 0, recebido = 0;
          for (const c of comandas) {
            for (const pg of c.pagamentos) porForma[pg.forma] += pg.valor;
            if (c.status === "fechada") {
              pessoas.adultos += c.adultos;
              pessoas.criancas += c.criancas;
              pessoas.menores += c.menores;
              descontos += c.descontos;
            }
            recebido += c.pago;
          }
          const retiradas = movimentos.filter((m) => m.tipo === "retirada").reduce((s, m) => s + m.valor, 0);
          const reposicoes = movimentos.filter((m) => m.tipo === "reposicao").reduce((s, m) => s + m.valor, 0);
          const dinheiroEsperado = d.troco_inicial + porForma.dinheiro - retiradas + reposicoes;
          return {
            porForma,
            pessoas,
            descontos,
            recebido,
            retiradas,
            reposicoes,
            dinheiroEsperado,
            diferencaDinheiro: d.dinheiro_contado == null ? null : d.dinheiro_contado - dinheiroEsperado,
            diferencaCartao: d.maquininha_informado == null ? null : d.maquininha_informado - porForma.cartao,
            abertas: comandas.filter((c) => c.status === "aberta").length
          };
        }
        function proximoNumero(comandas) {
          const emUso = new Set(comandas.filter((c) => c.status === "aberta").map((c) => c.numero));
          const ultimo = [...comandas].reverse().find((c) => /^\d+$/.test(c.numero));
          let n = ultimo ? Number(ultimo.numero) + 1 : 1;
          while (emUso.has(String(n))) n++;
          return String(n);
        }
        function conferencia(comandas, p) {
          const soma = (lista, sufixo) => lista.reduce((s, c) => ({
            adultos: s.adultos + c["adultos" + sufixo],
            criancas: s.criancas + c["criancas" + sufixo],
            menores: s.menores + c["menores" + sufixo]
          }), { adultos: 0, criancas: 0, menores: 0 });
          const fechadas = comandas.filter((c) => c.status === "fechada");
          const valorEntrada = (c) => c.adultos_entrada * p.adulto + c.criancas_entrada * p.crianca + c.menores_entrada * p.menor;
          const amenos = fechadas.filter((c) => c.adultos < c.adultos_entrada || c.criancas < c.criancas_entrada || c.menores < c.menores_entrada).map((c) => ({ id: c.id, numero: c.numero, nome: c.nome, diferenca: Math.max(valorEntrada(c) - c.bruto, 0) }));
          const abertas = comandas.filter((c) => c.status === "aberta");
          const naoPagas = comandas.filter((c) => c.status === "nao_pago");
          return {
            entraram: soma(comandas, "_entrada"),
            pagaram: soma(fechadas, ""),
            grupos: comandas.length,
            gruposPagos: fechadas.length,
            abertas: abertas.map((c) => ({ id: c.id, numero: c.numero, nome: c.nome, valor: c.total })),
            naoPagas: naoPagas.map((c) => ({ id: c.id, numero: c.numero, nome: c.nome, valor: valorEntrada(c), motivo: c.motivo_nao_pago })),
            amenos,
            perdaNaoPagas: naoPagas.reduce((s, c) => s + valorEntrada(c), 0),
            perdaAMenos: amenos.reduce((s, c) => s + c.diferenca, 0)
          };
        }
        function estado(data) {
          const d = dia(data);
          const p = precos();
          const espacos = q("SELECT * FROM espacos ORDER BY ordem, id");
          const mesas = q("SELECT * FROM mesas WHERE ativa = 1 ORDER BY espaco_id, CAST(numero AS INTEGER), numero");
          const estados = new Map(q("SELECT * FROM mesa_estado WHERE dia_id = ?", d.id).map((e) => [e.mesa_id, e]));
          const reservas = q("SELECT * FROM reservas WHERE dia_id = ? ORDER BY nome COLLATE NOCASE", d.id).map((r) => ({
            ...r,
            mesas: q("SELECT mesa_id FROM reserva_mesas WHERE reserva_id = ?", r.id).map((x) => x.mesa_id),
            comanda_id: um("SELECT id FROM comandas WHERE reserva_id = ? ORDER BY id DESC", r.id)?.id ?? null
          }));
          const comandas = q("SELECT * FROM comandas WHERE dia_id = ? ORDER BY id", d.id).map((c) => comandaCompleta(c, p));
          const mesasDia = mesas.map((m) => {
            const e = estados.get(m.id) || {};
            const aberta = comandas.find((c) => c.status === "aberta" && c.mesas.includes(m.id));
            const reservadas = reservas.filter((r) => r.status === "aguardando" && r.mesas.includes(m.id));
            let situacao = "livre";
            if (aberta) situacao = "ocupada";
            else if (e.limpando) situacao = "limpando";
            else if (reservadas.length) situacao = "reservada";
            return {
              ...m,
              situacao,
              alerta: e.alerta || null,
              comanda_id: aberta?.id ?? null,
              reservas: reservadas.map((r) => r.id)
            };
          });
          const movimentos = q("SELECT * FROM caixa_movimentos WHERE dia_id = ? ORDER BY id", d.id);
          const ocorrencias = q("SELECT * FROM ocorrencias WHERE dia_id = ? ORDER BY id DESC", d.id);
          return {
            data,
            hoje: hoje2(),
            dia: d,
            precos: p,
            espacos,
            mesas: mesasDia,
            reservas,
            comandas,
            movimentos,
            ocorrencias,
            caixa: resumoCaixa(d, comandas, movimentos),
            conferencia: conferencia(comandas, p),
            proximoNumero: proximoNumero(comandas)
          };
        }
        app2.get("/api/estado", (req, res) => res.json(estado(dataValida(req.query.data))));
        const altera = (fn) => (req, res) => {
          const data = dataValida(req.body.data || req.query.data);
          const resultado = tx(() => fn(req, data));
          avisar(data);
          res.json(resultado ?? { ok: true });
        };
        function mesasPorNumero(numeros2) {
          const ids = [];
          for (const n of numeros2) {
            const m = um("SELECT id FROM mesas WHERE numero = ? AND ativa = 1", String(n).trim());
            if (!m) throw erro(400, `Mesa ${n} n\xE3o existe.`);
            ids.push(m.id);
          }
          return ids;
        }
        function validarMesas(ids) {
          return [...new Set((ids || []).map((i) => inteiro(i, "mesa", { min: 1 })))].map((id) => {
            if (!um("SELECT id FROM mesas WHERE id = ? AND ativa = 1", id)) throw erro(400, "Mesa n\xE3o encontrada.");
            return id;
          });
        }
        function dadosReserva(b) {
          return {
            nome: texto(b.nome, "nome", { obrigatorio: true, max: 120 }),
            tipo: b.tipo === "evento" ? "evento" : "familia",
            adultos: inteiro(b.adultos, "adultos", { max: 500 }),
            criancas: inteiro(b.criancas, "crian\xE7as", { max: 500 }),
            menores: inteiro(b.menores, "menores de 6", { max: 500 }),
            telefone: texto(b.telefone, "telefone", { max: 30 }),
            obs: texto(b.obs, "observa\xE7\xE3o", { max: 300 })
          };
        }
        function gravarMesasReserva(reservaId, mesas) {
          run("DELETE FROM reserva_mesas WHERE reserva_id = ?", reservaId);
          for (const m of mesas) run("INSERT INTO reserva_mesas (reserva_id, mesa_id) VALUES (?, ?)", reservaId, m);
        }
        app2.post("/api/reservas", CAIXA, altera((req, data) => {
          const d = dia(data);
          const r = dadosReserva(req.body);
          const mesas = validarMesas(req.body.mesas);
          const { lastInsertRowid: id } = run(
            `INSERT INTO reservas (dia_id, nome, tipo, adultos, criancas, menores, telefone, obs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            d.id,
            r.nome,
            r.tipo,
            r.adultos,
            r.criancas,
            r.menores,
            r.telefone,
            r.obs
          );
          gravarMesasReserva(id, mesas);
          registrar(d.id, req.usuario, "Reserva criada", r.nome);
          return { id: Number(id) };
        }));
        app2.put("/api/reservas/:id", CAIXA, altera((req, data) => {
          const atual = um("SELECT * FROM reservas WHERE id = ?", req.params.id);
          if (!atual) throw erro(404, "Reserva n\xE3o encontrada.");
          const r = dadosReserva(req.body);
          run(`UPDATE reservas SET nome = ?, tipo = ?, adultos = ?, criancas = ?, menores = ?, telefone = ?, obs = ?
         WHERE id = ?`, r.nome, r.tipo, r.adultos, r.criancas, r.menores, r.telefone, r.obs, atual.id);
          if (req.body.mesas) gravarMesasReserva(atual.id, validarMesas(req.body.mesas));
          registrar(atual.dia_id, req.usuario, "Reserva alterada", r.nome);
        }));
        app2.delete("/api/reservas/:id", CAIXA, altera((req) => {
          const r = um("SELECT * FROM reservas WHERE id = ?", req.params.id);
          if (!r) throw erro(404, "Reserva n\xE3o encontrada.");
          if (um("SELECT id FROM comandas WHERE reserva_id = ?", r.id)) throw erro(409, "Essa reserva j\xE1 tem comanda. Marque como cancelada em vez de apagar.");
          run("DELETE FROM reservas WHERE id = ?", r.id);
          registrar(r.dia_id, req.usuario, "Reserva apagada", r.nome);
        }));
        app2.post("/api/reservas/importar", CAIXA, altera((req, data) => {
          const d = dia(data);
          const linhas = String(req.body.texto || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          if (!linhas.length) throw erro(400, "Cole pelo menos uma linha.");
          let criadas = 0;
          linhas.forEach((linha, i) => {
            const partes = linha.split(/\t|;/).map((s) => s.trim());
            try {
              const r = dadosReserva({
                nome: partes[0],
                adultos: partes[1] || 0,
                criancas: partes[2] || 0,
                menores: partes[3] || 0,
                obs: partes[5],
                tipo: Number(partes[1] || 0) + Number(partes[2] || 0) >= 15 ? "evento" : "familia"
              });
              const mesas = partes[4] ? mesasPorNumero(partes[4].split(/[+,\s/]+/).filter(Boolean)) : [];
              const { lastInsertRowid: id } = run(
                `INSERT INTO reservas (dia_id, nome, tipo, adultos, criancas, menores, obs) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                d.id,
                r.nome,
                r.tipo,
                r.adultos,
                r.criancas,
                r.menores,
                r.obs
              );
              gravarMesasReserva(id, mesas);
              criadas++;
            } catch (e) {
              throw erro(400, `Linha ${i + 1} ("${linha.slice(0, 40)}"): ${e.message}`);
            }
          });
          registrar(d.id, req.usuario, "Reservas importadas", `${criadas} reservas`);
          return { criadas };
        }));
        app2.post("/api/reservas/:id/status", CAIXA, altera((req) => {
          const r = um("SELECT * FROM reservas WHERE id = ?", req.params.id);
          if (!r) throw erro(404, "Reserva n\xE3o encontrada.");
          const status = req.body.status;
          if (!["aguardando", "faltou", "cancelada"].includes(status)) throw erro(400, "Situa\xE7\xE3o inv\xE1lida.");
          if (um("SELECT id FROM comandas WHERE reserva_id = ? AND status = 'aberta'", r.id)) throw erro(409, "Essa reserva j\xE1 est\xE1 na mesa.");
          run("UPDATE reservas SET status = ? WHERE id = ?", status, r.id);
          registrar(r.dia_id, req.usuario, `Reserva marcada como ${status}`, r.nome);
        }));
        function conflitoMesas(mesas, ignorarComanda = 0) {
          for (const m of mesas) {
            const c = um(`SELECT c.nome, me.numero FROM comanda_mesas cm JOIN comandas c ON c.id = cm.comanda_id
                    JOIN mesas me ON me.id = cm.mesa_id
                    WHERE cm.mesa_id = ? AND c.status = 'aberta' AND c.id != ?`, m, ignorarComanda);
            if (c) throw erro(409, `A mesa ${c.numero} j\xE1 est\xE1 ocupada por ${c.nome}.`);
          }
        }
        function abrirComanda(d, usuario, { numero, nome, adultos, criancas, menores, reservaId = null, mesas = [] }) {
          if (adultos + criancas + menores === 0) throw erro(400, "Informe quantas pessoas entraram.");
          const emUso = um("SELECT nome FROM comandas WHERE dia_id = ? AND numero = ? AND status = 'aberta'", d.id, numero);
          if (emUso) throw erro(409, `A comanda ${numero} j\xE1 est\xE1 com ${emUso.nome || "outro grupo"} e ainda n\xE3o foi paga.`);
          conflitoMesas(mesas);
          const { lastInsertRowid: id } = run(
            `INSERT INTO comandas (dia_id, numero, reserva_id, nome, adultos_entrada, criancas_entrada, menores_entrada,
                             adultos, criancas, menores, registrada_por, aberta_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            d.id,
            numero,
            reservaId,
            nome,
            adultos,
            criancas,
            menores,
            adultos,
            criancas,
            menores,
            usuario.nome,
            agora()
          );
          for (const m of mesas) {
            run("INSERT INTO comanda_mesas (comanda_id, mesa_id) VALUES (?, ?)", id, m);
            run(`INSERT INTO mesa_estado (dia_id, mesa_id, limpando, alerta) VALUES (?, ?, 0, NULL)
           ON CONFLICT (dia_id, mesa_id) DO UPDATE SET limpando = 0, alerta = NULL`, d.id, m);
          }
          registrar(d.id, usuario, "Entrada", `Comanda ${numero}${nome ? " \xB7 " + nome : ""} \xB7 ${adultos}/${criancas}/${menores}` + (mesas.length ? ` \xB7 mesa ${numeros(mesas)}` : ""));
          return Number(id);
        }
        function dadosEntrada(b) {
          return {
            numero: texto(b.numero, "n\xFAmero da comanda", { obrigatorio: true, max: 10 }),
            nome: texto(b.nome, "nome", { max: 120 }),
            adultos: inteiro(b.adultos, "adultos", { max: 500 }),
            criancas: inteiro(b.criancas, "crian\xE7as", { max: 500 }),
            menores: inteiro(b.menores, "menores de 6", { max: 500 }),
            mesas: validarMesas(b.mesas)
          };
        }
        function numeros(mesaIds) {
          return mesaIds.map((id) => um("SELECT numero FROM mesas WHERE id = ?", id)?.numero).join(", ");
        }
        function comandaAberta(id) {
          const c = um("SELECT * FROM comandas WHERE id = ?", id);
          if (!c) throw erro(404, "Comanda n\xE3o encontrada.");
          if (c.status !== "aberta") throw erro(409, "Essa comanda j\xE1 foi fechada.");
          return c;
        }
        app2.post("/api/comandas", SALAO, altera((req, data) => {
          const d = diaAberto(data);
          const e = dadosEntrada(req.body);
          let reservaId = null;
          if (req.body.reserva_id) {
            const r = um("SELECT * FROM reservas WHERE id = ? AND dia_id = ?", req.body.reserva_id, d.id);
            if (!r) throw erro(404, "Reserva n\xE3o encontrada.");
            if (r.status === "chegou") throw erro(409, `${r.nome} j\xE1 entrou.`);
            reservaId = r.id;
            e.nome = e.nome || r.nome;
            run("UPDATE reservas SET status = ?, chegou_em = ? WHERE id = ?", "chegou", agora(), r.id);
          }
          return { comanda_id: abrirComanda(d, req.usuario, { ...e, reservaId }) };
        }));
        app2.put("/api/comandas/:id", SALAO, altera((req) => {
          const c = comandaAberta(req.params.id);
          const novo = {
            nome: texto(req.body.nome ?? c.nome, "nome", { max: 120 }),
            numero: texto(req.body.numero ?? c.numero, "n\xFAmero da comanda", { obrigatorio: true, max: 10 }),
            adultos: inteiro(req.body.adultos ?? c.adultos, "adultos", { max: 500 }),
            criancas: inteiro(req.body.criancas ?? c.criancas, "crian\xE7as", { max: 500 }),
            menores: inteiro(req.body.menores ?? c.menores, "menores de 6", { max: 500 })
          };
          if (novo.numero !== c.numero && um("SELECT 1 FROM comandas WHERE dia_id = ? AND numero = ? AND status = 'aberta' AND id != ?", c.dia_id, novo.numero, c.id)) {
            throw erro(409, `A comanda ${novo.numero} j\xE1 est\xE1 em uso.`);
          }
          run(
            "UPDATE comandas SET nome = ?, numero = ?, adultos = ?, criancas = ?, menores = ? WHERE id = ?",
            novo.nome,
            novo.numero,
            novo.adultos,
            novo.criancas,
            novo.menores,
            c.id
          );
          const mudou = novo.adultos !== c.adultos || novo.criancas !== c.criancas || novo.menores !== c.menores;
          if (req.body.corrigir_entrada) {
            run(
              "UPDATE comandas SET adultos_entrada = ?, criancas_entrada = ?, menores_entrada = ? WHERE id = ?",
              novo.adultos,
              novo.criancas,
              novo.menores,
              c.id
            );
            registrar(
              c.dia_id,
              req.usuario,
              "Entrada corrigida",
              `Comanda ${c.numero}: ${c.adultos_entrada}/${c.criancas_entrada}/${c.menores_entrada} \u2192 ${novo.adultos}/${novo.criancas}/${novo.menores}`
            );
          } else if (mudou) {
            registrar(
              c.dia_id,
              req.usuario,
              "Pessoas ajustadas",
              `Comanda ${c.numero}: ${c.adultos}/${c.criancas}/${c.menores} \u2192 ${novo.adultos}/${novo.criancas}/${novo.menores}`
            );
          }
          if (novo.numero !== c.numero) registrar(c.dia_id, req.usuario, "N\xFAmero da comanda trocado", `${c.numero} \u2192 ${novo.numero}`);
        }));
        app2.post("/api/comandas/:id/nao-pago", CAIXA, altera((req) => {
          const c = comandaAberta(req.params.id);
          const motivo = texto(req.body.motivo, "o que aconteceu", { obrigatorio: true, max: 200 });
          if (um("SELECT 1 FROM pagamentos WHERE comanda_id = ?", c.id)) throw erro(409, "Essa comanda j\xE1 tem pagamento. Feche normalmente.");
          run("UPDATE comandas SET status = 'nao_pago', motivo_nao_pago = ?, fechada_em = ? WHERE id = ?", motivo, agora(), c.id);
          for (const m of q("SELECT mesa_id FROM comanda_mesas WHERE comanda_id = ?", c.id)) {
            run(`INSERT INTO mesa_estado (dia_id, mesa_id, limpando) VALUES (?, ?, 1)
           ON CONFLICT (dia_id, mesa_id) DO UPDATE SET limpando = 1`, c.dia_id, m.mesa_id);
          }
          registrar(c.dia_id, req.usuario, "Saiu sem pagar", `Comanda ${c.numero}${c.nome ? " \xB7 " + c.nome : ""} \xB7 ${motivo}`);
        }));
        app2.post("/api/comandas/:id/mover", SALAO, altera((req, data) => {
          const c = comandaAberta(req.params.id);
          const de = inteiro(req.body.de, "mesa de origem", { min: 1 });
          const [para] = validarMesas([req.body.para]);
          if (!um("SELECT 1 FROM comanda_mesas WHERE comanda_id = ? AND mesa_id = ?", c.id, de)) throw erro(400, "A comanda n\xE3o est\xE1 nessa mesa.");
          conflitoMesas([para], c.id);
          run("UPDATE comanda_mesas SET mesa_id = ? WHERE comanda_id = ? AND mesa_id = ?", para, c.id, de);
          run(`INSERT INTO mesa_estado (dia_id, mesa_id, limpando) VALUES (?, ?, 1)
         ON CONFLICT (dia_id, mesa_id) DO UPDATE SET limpando = 1`, c.dia_id, de);
          run(`INSERT INTO mesa_estado (dia_id, mesa_id, limpando, alerta) VALUES (?, ?, 0, NULL)
         ON CONFLICT (dia_id, mesa_id) DO UPDATE SET limpando = 0, alerta = NULL`, c.dia_id, para);
          registrar(c.dia_id, req.usuario, "Troca de mesa", `${c.nome}: mesa ${numeros([de])} \u2192 ${numeros([para])}`);
        }));
        app2.post("/api/comandas/:id/mesas", SALAO, altera((req) => {
          const c = comandaAberta(req.params.id);
          const [mesa] = validarMesas([req.body.mesa_id]);
          conflitoMesas([mesa], c.id);
          run("INSERT OR IGNORE INTO comanda_mesas (comanda_id, mesa_id) VALUES (?, ?)", c.id, mesa);
          registrar(c.dia_id, req.usuario, "Mesa juntada", `${c.nome}: + mesa ${numeros([mesa])}`);
        }));
        app2.delete("/api/comandas/:id/mesas/:mesa", SALAO, altera((req) => {
          const c = comandaAberta(req.params.id);
          run("DELETE FROM comanda_mesas WHERE comanda_id = ? AND mesa_id = ?", c.id, req.params.mesa);
          run(`INSERT INTO mesa_estado (dia_id, mesa_id, limpando) VALUES (?, ?, 1)
         ON CONFLICT (dia_id, mesa_id) DO UPDATE SET limpando = 1`, c.dia_id, req.params.mesa);
          registrar(c.dia_id, req.usuario, "Mesa liberada da comanda", `${c.nome}: \u2212 mesa ${numeros([Number(req.params.mesa)])}`);
        }));
        app2.post("/api/comandas/:id/vouchers", CAIXA, altera((req, data) => {
          const c = comandaAberta(req.params.id);
          const codigo = texto(req.body.codigo, "c\xF3digo", { obrigatorio: true }).toUpperCase();
          const v = um("SELECT * FROM vouchers WHERE UPPER(codigo) = ?", codigo);
          if (!v || !v.ativo) throw erro(404, "Voucher n\xE3o encontrado ou desativado.");
          if (v.validade && v.validade < data) throw erro(409, `Voucher venceu em ${v.validade.split("-").reverse().join("/")}.`);
          const usos = um("SELECT COUNT(*) n FROM comanda_vouchers WHERE voucher_id = ?", v.id).n;
          if (usos >= v.usos_max) throw erro(409, "Esse voucher j\xE1 foi usado.");
          run("INSERT INTO comanda_vouchers (comanda_id, voucher_id) VALUES (?, ?)", c.id, v.id);
          registrar(c.dia_id, req.usuario, "Voucher aplicado", `${v.codigo} em ${c.nome}`);
        }));
        app2.delete("/api/comandas/:id/vouchers/:vid", CAIXA, altera((req) => {
          const c = comandaAberta(req.params.id);
          run("DELETE FROM comanda_vouchers WHERE comanda_id = ? AND voucher_id = ?", c.id, req.params.vid);
          registrar(c.dia_id, req.usuario, "Voucher removido", c.nome);
        }));
        app2.post("/api/comandas/:id/desconto", CAIXA, altera((req) => {
          const c = comandaAberta(req.params.id);
          const valor = inteiro(req.body.valor, "valor do desconto");
          const motivo = texto(req.body.motivo, "motivo", { obrigatorio: valor > 0, max: 200 });
          const autorizou = valor > 0 ? autorizacaoDono(req) : null;
          run(
            "UPDATE comandas SET desconto = ?, desconto_motivo = ?, desconto_autorizado_por = ? WHERE id = ?",
            valor,
            motivo || null,
            autorizou,
            c.id
          );
          registrar(c.dia_id, req.usuario, "Desconto", `${c.nome}: ${reais(valor)} \xB7 ${motivo} \xB7 autorizado por ${autorizou}`);
        }));
        app2.post("/api/comandas/:id/pagamentos", CAIXA, altera((req) => {
          const c = comandaAberta(req.params.id);
          if (!FORMAS.includes(req.body.forma)) throw erro(400, "Forma de pagamento inv\xE1lida.");
          const valor = inteiro(req.body.valor, "valor", { min: 1 });
          run(
            "INSERT INTO pagamentos (comanda_id, forma, valor, por, em) VALUES (?, ?, ?, ?, ?)",
            c.id,
            req.body.forma,
            valor,
            req.usuario.nome,
            agora()
          );
          registrar(c.dia_id, req.usuario, "Pagamento", `${c.nome}: ${NOME_FORMA[req.body.forma]} ${reais(valor)}`);
        }));
        app2.delete("/api/comandas/:id/pagamentos/:pid", CAIXA, altera((req) => {
          const c = comandaAberta(req.params.id);
          const p = um("SELECT * FROM pagamentos WHERE id = ? AND comanda_id = ?", req.params.pid, c.id);
          if (!p) throw erro(404, "Pagamento n\xE3o encontrado.");
          run("DELETE FROM pagamentos WHERE id = ?", p.id);
          registrar(c.dia_id, req.usuario, "Pagamento removido", `${c.nome}: ${NOME_FORMA[p.forma]} ${reais(p.valor)}`);
        }));
        app2.post("/api/comandas/:id/fechar", CAIXA, altera((req) => {
          const c = comandaAberta(req.params.id);
          const completa = comandaCompleta(c, precos());
          if (completa.falta > 0) throw erro(409, `Ainda falta receber ${reais(completa.falta)}.`);
          if (completa.falta < 0) throw erro(409, `Foi recebido ${reais(-completa.falta)} a mais. Devolva ao cliente e corrija o pagamento antes de fechar.`);
          run("UPDATE comandas SET status = 'fechada', fechada_em = ? WHERE id = ?", agora(), c.id);
          for (const m of completa.mesas) {
            run(`INSERT INTO mesa_estado (dia_id, mesa_id, limpando) VALUES (?, ?, 1)
           ON CONFLICT (dia_id, mesa_id) DO UPDATE SET limpando = 1`, c.dia_id, m);
          }
          registrar(c.dia_id, req.usuario, "Comanda fechada", `${c.nome}: ${reais(completa.total)}`);
        }));
        app2.post("/api/comandas/:id/reabrir", CAIXA, altera((req) => {
          const autorizou = autorizacaoDono(req);
          const c = um("SELECT * FROM comandas WHERE id = ?", req.params.id);
          if (!c || c.status === "aberta") throw erro(404, "Comanda fechada n\xE3o encontrada.");
          if (um("SELECT 1 FROM comandas WHERE dia_id = ? AND numero = ? AND status = 'aberta'", c.dia_id, c.numero)) {
            throw erro(409, `A comanda ${c.numero} j\xE1 foi entregue a outro grupo. Troque o n\xFAmero antes de reabrir.`);
          }
          const mesas = q("SELECT mesa_id FROM comanda_mesas WHERE comanda_id = ?", c.id).map((r) => r.mesa_id);
          conflitoMesas(mesas, c.id);
          run("UPDATE comandas SET status = 'aberta', fechada_em = NULL, motivo_nao_pago = NULL WHERE id = ?", c.id);
          registrar(c.dia_id, req.usuario, "Comanda reaberta", `Comanda ${c.numero} \xB7 autorizado por ${autorizou}`);
        }));
        app2.post("/api/mesas/:id/estado", SALAO, altera((req, data) => {
          const d = dia(data);
          const [mesa] = validarMesas([req.params.id]);
          const atual = um("SELECT * FROM mesa_estado WHERE dia_id = ? AND mesa_id = ?", d.id, mesa) || { limpando: 0, alerta: null };
          const limpando = req.body.limpando === void 0 ? atual.limpando : req.body.limpando ? 1 : 0;
          const alerta = req.body.alerta === void 0 ? atual.alerta : texto(req.body.alerta, "alerta", { max: 120 }) || null;
          run(
            `INSERT INTO mesa_estado (dia_id, mesa_id, limpando, alerta) VALUES (?, ?, ?, ?)
         ON CONFLICT (dia_id, mesa_id) DO UPDATE SET limpando = excluded.limpando, alerta = excluded.alerta`,
            d.id,
            mesa,
            limpando,
            alerta
          );
          if (req.body.alerta) registrar(d.id, req.usuario, "Alerta na mesa", `Mesa ${numeros([mesa])}: ${alerta}`);
        }));
        app2.post("/api/caixa/movimentos", CAIXA, altera((req, data) => {
          const d = diaAberto(data);
          const tipo = req.body.tipo === "reposicao" ? "reposicao" : "retirada";
          const valor = inteiro(req.body.valor, "valor", { min: 1 });
          const motivo = texto(req.body.motivo, "motivo", { obrigatorio: true, max: 200 });
          const quem = texto(req.body.quem, "quem", { obrigatorio: true, max: 60 });
          run(`INSERT INTO caixa_movimentos (dia_id, tipo, valor, motivo, quem, registrado_por, em)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, d.id, tipo, valor, motivo, quem, req.usuario.nome, agora());
          registrar(d.id, req.usuario, tipo === "retirada" ? "Retirada do caixa" : "Reposi\xE7\xE3o no caixa", `${reais(valor)} \xB7 ${quem} \xB7 ${motivo}`);
        }));
        app2.delete("/api/caixa/movimentos/:id", DONO, altera((req) => {
          const m = um("SELECT * FROM caixa_movimentos WHERE id = ?", req.params.id);
          if (!m) throw erro(404, "Movimento n\xE3o encontrado.");
          run("DELETE FROM caixa_movimentos WHERE id = ?", m.id);
          registrar(m.dia_id, req.usuario, "Movimento do caixa apagado", `${reais(m.valor)} \xB7 ${m.motivo}`);
        }));
        app2.post("/api/caixa/troco", CAIXA, altera((req, data) => {
          const d = diaAberto(data);
          const valor = inteiro(req.body.valor, "troco inicial");
          run("UPDATE dias SET troco_inicial = ? WHERE id = ?", valor, d.id);
          registrar(d.id, req.usuario, "Troco inicial", reais(valor));
        }));
        app2.post("/api/caixa/fechar", CAIXA, altera((req, data) => {
          const d = diaAberto(data);
          const abertas = um("SELECT COUNT(*) n FROM comandas WHERE dia_id = ? AND status = 'aberta'", d.id).n;
          if (abertas) throw erro(409, `Ainda h\xE1 ${abertas} comanda(s) sem pagamento. Receba ou marque como "saiu sem pagar".`);
          const maquininha = inteiro(req.body.maquininha, "total da maquininha");
          const contado = inteiro(req.body.dinheiro_contado, "dinheiro contado");
          run(
            "UPDATE dias SET maquininha_informado = ?, dinheiro_contado = ?, fechado_em = ?, fechado_por = ? WHERE id = ?",
            maquininha,
            contado,
            agora(),
            req.usuario.nome,
            d.id
          );
          registrar(d.id, req.usuario, "Caixa fechado", `maquininha ${reais(maquininha)} \xB7 dinheiro ${reais(contado)}`);
        }));
        app2.post("/api/caixa/reabrir", DONO, altera((req, data) => {
          const d = dia(data);
          run("UPDATE dias SET fechado_em = NULL, fechado_por = NULL WHERE id = ?", d.id);
          registrar(d.id, req.usuario, "Caixa reaberto");
        }));
        app2.post("/api/ocorrencias", SALAO, altera((req, data) => {
          const d = dia(data);
          const categoria = texto(req.body.categoria, "categoria", { obrigatorio: true, max: 40 });
          const t = texto(req.body.texto, "o que aconteceu", { obrigatorio: true, max: 500 });
          const mesa = req.body.mesa_id ? validarMesas([req.body.mesa_id])[0] : null;
          run(
            "INSERT INTO ocorrencias (dia_id, categoria, texto, mesa_id, por, em) VALUES (?, ?, ?, ?, ?, ?)",
            d.id,
            categoria,
            t,
            mesa,
            req.usuario.nome,
            agora()
          );
        }));
        app2.get("/api/relatorio", CAIXA, (req, res) => {
          const e = estado(dataValida(req.query.data));
          const c = e.caixa;
          const [a, m, dd] = e.data.split("-");
          const reservas = e.reservas;
          const chegaram = reservas.filter((r) => r.status === "chegou").length;
          const faltaram = reservas.filter((r) => r.status === "faltou").length;
          const semReserva = e.comandas.filter((x) => !x.reserva_id).length;
          const cf = e.conferencia;
          const qtd = (p) => `${p.adultos + p.criancas + p.menores} (adultos: ${p.adultos} \xB7 crian\xE7as 6\u201310: ${p.criancas} \xB7 menores de 6: ${p.menores})`;
          const linhas = [
            `\u2615 Casa Du Vov\xF4 \xB7 ${dd}/${m}/${a}`,
            `Entraram: ${qtd(cf.entraram)}`,
            `Pagaram: ${qtd(cf.pagaram)}`,
            `Reservas: ${chegaram} chegaram \xB7 ${faltaram} faltaram \xB7 ${semReserva} grupos sem reserva`,
            `Recebido: ${reais(c.recebido)} (Pix ${reais(c.porForma.pix)} \xB7 Cart\xE3o ${reais(c.porForma.cartao)} \xB7 Dinheiro ${reais(c.porForma.dinheiro)})`,
            `Vouchers e descontos: ${reais(c.descontos)}`,
            `Retiradas do caixa: ${reais(c.retiradas)}${c.reposicoes ? ` \xB7 Reposi\xE7\xF5es: ${reais(c.reposicoes)}` : ""}`
          ];
          for (const mv of e.movimentos) {
            linhas.push(`  \u2022 ${mv.tipo === "retirada" ? "Retirada" : "Reposi\xE7\xE3o"} ${reais(mv.valor)} \xB7 ${mv.quem} \xB7 ${mv.motivo}`);
          }
          if (c.diferencaDinheiro != null) {
            linhas.push(`Dinheiro: esperado ${reais(c.dinheiroEsperado)} \xB7 contado ${reais(e.dia.dinheiro_contado)} \xB7 diferen\xE7a ${reais(c.diferencaDinheiro)}`);
            linhas.push(`Cart\xE3o: sistema ${reais(c.porForma.cartao)} \xB7 maquininha ${reais(e.dia.maquininha_informado)} \xB7 diferen\xE7a ${reais(c.diferencaCartao)}`);
          } else {
            linhas.push("Caixa ainda n\xE3o fechado.");
          }
          if (cf.abertas.length) linhas.push(`\u26A0 Comandas ainda sem pagamento: ${cf.abertas.map((x) => x.numero).join(", ")}`);
          if (cf.naoPagas.length) {
            linhas.push(`\u26A0 Sa\xEDram sem pagar: ${cf.naoPagas.length} comanda(s) \xB7 ${reais(cf.perdaNaoPagas)}`);
            for (const x of cf.naoPagas) linhas.push(`  \u2022 Comanda ${x.numero}${x.nome ? " \xB7 " + x.nome : ""} \xB7 ${x.motivo}`);
          }
          if (cf.amenos.length) {
            linhas.push(`\u26A0 Cobradas com menos gente do que entrou: ${cf.amenos.length} comanda(s) \xB7 ${reais(cf.perdaAMenos)}`);
            for (const x of cf.amenos) linhas.push(`  \u2022 Comanda ${x.numero}${x.nome ? " \xB7 " + x.nome : ""} \xB7 ${reais(x.diferenca)}`);
          }
          if (!cf.abertas.length && !cf.naoPagas.length && !cf.amenos.length && cf.grupos) {
            linhas.push("\u2713 Confer\xEAncia ok: todo mundo que entrou pagou.");
          }
          const trocas = um("SELECT COUNT(*) n FROM historico WHERE dia_id = ? AND acao = 'Troca de mesa'", e.dia.id).n;
          linhas.push(`Trocas de mesa: ${trocas} \xB7 Ocorr\xEAncias: ${e.ocorrencias.length}`);
          for (const o of e.ocorrencias) linhas.push(`  \u2022 [${o.categoria}] ${o.texto}`);
          res.json({ texto: linhas.join("\n") });
        });
        app2.get("/api/historico", CAIXA, (req, res) => {
          const d = dia(dataValida(req.query.data));
          res.json(q("SELECT * FROM historico WHERE dia_id = ? ORDER BY id DESC LIMIT 300", d.id));
        });
        app2.get("/api/vouchers", CAIXA, (req, res) => {
          res.json(q(`SELECT v.*, (SELECT COUNT(*) FROM comanda_vouchers cv WHERE cv.voucher_id = v.id) usos
                FROM vouchers v ORDER BY v.id DESC LIMIT 300`));
        });
        function novoCodigo() {
          const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
          for (; ; ) {
            const c = "VOVO-" + Array.from(crypto2.randomBytes(4), (b) => letras[b % letras.length]).join("");
            if (!um("SELECT 1 FROM vouchers WHERE codigo = ?", c)) return c;
          }
        }
        app2.post("/api/vouchers", DONO, altera((req) => {
          const tipo = req.body.tipo;
          if (!["cortesia", "percentual", "valor"].includes(tipo)) throw erro(400, "Tipo de voucher inv\xE1lido.");
          const valor = inteiro(req.body.valor, "valor", { min: 1, max: tipo === "percentual" ? 100 : 1e8 });
          const validade = req.body.validade ? dataValida(req.body.validade) : null;
          const codigo = novoCodigo();
          run(
            `INSERT INTO vouchers (codigo, cliente, tipo, valor, motivo, validade, usos_max, criado_por, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            codigo,
            texto(req.body.cliente, "cliente", { obrigatorio: true, max: 120 }),
            tipo,
            valor,
            texto(req.body.motivo, "motivo", { max: 120 }),
            validade,
            inteiro(req.body.usos_max || 1, "usos", { min: 1, max: 1e3 }),
            req.usuario.nome,
            agora()
          );
          registrar(null, req.usuario, "Voucher criado", codigo);
          return { codigo };
        }));
        app2.put("/api/vouchers/:id", DONO, altera((req) => {
          run("UPDATE vouchers SET ativo = ? WHERE id = ?", req.body.ativo ? 1 : 0, req.params.id);
          registrar(null, req.usuario, req.body.ativo ? "Voucher ativado" : "Voucher desativado", String(req.params.id));
        }));
        app2.get("/api/config", DONO, (req, res) => {
          res.json({
            precos: precos(),
            espacos: q("SELECT * FROM espacos ORDER BY ordem, id"),
            mesas: q("SELECT * FROM mesas ORDER BY espaco_id, CAST(numero AS INTEGER), numero"),
            usuarios: q("SELECT id, nome, papel, ativo FROM usuarios ORDER BY id")
          });
        });
        app2.put("/api/config/precos", DONO, altera((req) => {
          const p = {
            adulto: inteiro(req.body.adulto, "adulto"),
            crianca: inteiro(req.body.crianca, "crian\xE7a"),
            menor: inteiro(req.body.menor, "menor de 6")
          };
          run("UPDATE config SET valor = ? WHERE chave = 'precos'", JSON.stringify(p));
          registrar(null, req.usuario, "Pre\xE7os alterados", `${reais(p.adulto)} / ${reais(p.crianca)} / ${reais(p.menor)}`);
        }));
        app2.post("/api/config/espacos", DONO, altera((req) => {
          const max = um("SELECT COALESCE(MAX(ordem), 0) m FROM espacos").m;
          run("INSERT INTO espacos (nome, ordem) VALUES (?, ?)", texto(req.body.nome, "nome", { obrigatorio: true, max: 60 }), max + 1);
        }));
        app2.put("/api/config/espacos/:id", DONO, altera((req) => {
          run(
            "UPDATE espacos SET nome = ?, ordem = ? WHERE id = ?",
            texto(req.body.nome, "nome", { obrigatorio: true, max: 60 }),
            inteiro(req.body.ordem, "ordem"),
            req.params.id
          );
        }));
        app2.post("/api/config/mesas", DONO, altera((req) => {
          const numero = texto(req.body.numero, "n\xFAmero", { obrigatorio: true, max: 10 });
          if (um("SELECT 1 FROM mesas WHERE numero = ? AND ativa = 1", numero)) throw erro(409, `J\xE1 existe a mesa ${numero}.`);
          const espaco = inteiro(req.body.espaco_id, "espa\xE7o", { min: 1 });
          if (!um("SELECT 1 FROM espacos WHERE id = ?", espaco)) throw erro(400, "Espa\xE7o n\xE3o encontrado.");
          run(
            "INSERT INTO mesas (numero, espaco_id, lugares) VALUES (?, ?, ?)",
            numero,
            espaco,
            inteiro(req.body.lugares, "lugares", { min: 1, max: 100 })
          );
        }));
        app2.put("/api/config/mesas/:id", DONO, altera((req) => {
          const m = um("SELECT * FROM mesas WHERE id = ?", req.params.id);
          if (!m) throw erro(404, "Mesa n\xE3o encontrada.");
          const numero = texto(req.body.numero ?? m.numero, "n\xFAmero", { obrigatorio: true, max: 10 });
          const ativa = req.body.ativa === void 0 ? m.ativa : req.body.ativa ? 1 : 0;
          if (ativa && um("SELECT 1 FROM mesas WHERE numero = ? AND ativa = 1 AND id != ?", numero, m.id)) throw erro(409, `J\xE1 existe a mesa ${numero}.`);
          run(
            "UPDATE mesas SET numero = ?, espaco_id = ?, lugares = ?, ativa = ? WHERE id = ?",
            numero,
            inteiro(req.body.espaco_id ?? m.espaco_id, "espa\xE7o", { min: 1 }),
            inteiro(req.body.lugares ?? m.lugares, "lugares", { min: 1, max: 100 }),
            ativa,
            m.id
          );
        }));
        app2.post("/api/config/usuarios", DONO, altera((req) => {
          const pin = texto(req.body.pin, "PIN", { obrigatorio: true, max: 12 });
          if (!/^\d{4,12}$/.test(pin)) throw erro(400, "O PIN precisa ter de 4 a 12 n\xFAmeros.");
          if (!["dono", "atendente", "patio"].includes(req.body.papel)) throw erro(400, "Fun\xE7\xE3o inv\xE1lida.");
          run(
            "INSERT INTO usuarios (nome, papel, pin_hash) VALUES (?, ?, ?)",
            texto(req.body.nome, "nome", { obrigatorio: true, max: 60 }),
            req.body.papel,
            hashPin(pin)
          );
        }));
        app2.put("/api/config/usuarios/:id", DONO, altera((req) => {
          const u = um("SELECT * FROM usuarios WHERE id = ?", req.params.id);
          if (!u) throw erro(404, "Usu\xE1rio n\xE3o encontrado.");
          const papel = req.body.papel ?? u.papel;
          if (!["dono", "atendente", "patio"].includes(papel)) throw erro(400, "Fun\xE7\xE3o inv\xE1lida.");
          const ativo = req.body.ativo === void 0 ? u.ativo : req.body.ativo ? 1 : 0;
          if (u.papel === "dono" && (papel !== "dono" || !ativo)) {
            const outros = um("SELECT COUNT(*) n FROM usuarios WHERE papel = 'dono' AND ativo = 1 AND id != ?", u.id).n;
            if (!outros) throw erro(409, "Precisa ficar pelo menos um dono ativo.");
          }
          let hash = u.pin_hash;
          if (req.body.pin) {
            if (!/^\d{4,12}$/.test(String(req.body.pin))) throw erro(400, "O PIN precisa ter de 4 a 12 n\xFAmeros.");
            hash = hashPin(req.body.pin);
            run("DELETE FROM sessoes WHERE usuario_id = ?", u.id);
          }
          run(
            "UPDATE usuarios SET nome = ?, papel = ?, pin_hash = ?, ativo = ? WHERE id = ?",
            texto(req.body.nome ?? u.nome, "nome", { obrigatorio: true, max: 60 }),
            papel,
            hash,
            ativo,
            u.id
          );
          if (!ativo) run("DELETE FROM sessoes WHERE usuario_id = ?", u.id);
        }));
        app2.use("/api", (req, res) => res.status(404).json({ erro: "Rota n\xE3o encontrada." }));
        app2.use((err, req, res, next) => {
          if (err instanceof ErroHttp) return res.status(err.status).json({ erro: err.message });
          if (err.type === "entity.parse.failed") return res.status(400).json({ erro: "Dados inv\xE1lidos." });
          console.error(err);
          res.status(500).json({ erro: "Erro inesperado. Tente de novo." });
        });
        return app2;
      }
      module.exports = { criarApp: criarApp2, hoje: hoje2 };
    }
  });

  // demo/navegador.js
  var { preparar } = require_node_sqlite();
  var { abrir } = require_db();
  var { criarApp, hoje } = require_app();
  var CHAVE = "casaduvovo-demo";
  var ler = () => {
    try {
      return JSON.parse(localStorage.getItem(CHAVE));
    } catch {
      return null;
    }
  };
  var gravar = (v) => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(v));
    } catch {
    }
  };
  var paraBase64 = (b) => {
    let s = "";
    for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode(...b.subarray(i, i + 32768));
    return btoa(s);
  };
  var deBase64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  var app = null;
  var db = null;
  function servir(metodo, endereco, cabecalhos, corpo, resTempoReal) {
    const u = new URL(endereco, location.href);
    const caminho = u.pathname.slice(u.pathname.indexOf("/api/"));
    const fechar = [];
    const req = {
      method: metodo,
      path: caminho,
      query: Object.fromEntries(u.searchParams),
      body: corpo ? JSON.parse(corpo) : {},
      params: {},
      get: (nome) => cabecalhos.get(nome),
      on: (ev, fn) => {
        if (ev === "close") fechar.push(fn);
      }
    };
    let resposta = null;
    const res = resTempoReal || {
      statusCode: 200,
      status(n) {
        this.statusCode = n;
        return this;
      },
      json(o) {
        resposta = { status: this.statusCode, corpo: JSON.stringify(o) };
      },
      set() {
      },
      flushHeaders() {
      },
      write() {
      }
    };
    app.handle(req, res);
    if (metodo !== "GET" && resposta && resposta.status < 400) salvar();
    return { resposta, fechar };
  }
  function salvar() {
    gravar({ dia: hoje(), banco: paraBase64(db.exportar()) });
  }
  function semearExemplo() {
    const pedir = (token, metodo, url, corpo) => {
      const cab = new Headers(token ? { Authorization: "Bearer " + token } : {});
      const { resposta } = servir(metodo, url, cab, corpo && JSON.stringify(corpo));
      return JSON.parse(resposta.corpo);
    };
    const T = pedir(null, "POST", "/api/login", { usuario_id: 2, pin: "1111" }).token;
    const D = pedir(null, "POST", "/api/login", { usuario_id: 1, pin: "1234" }).token;
    const p = (tok, url, corpo) => pedir(tok, "POST", url, corpo);
    p(T, "/api/reservas/importar", { texto: "Fam\xEDlia Silva; 4; 1; 1; 3; quer sombra\nCh\xE1 de beb\xEA da Ana; 30; 6; 4; 10+11+12+13\nCasal Lima; 2; 0; 0; 5\nRosa Andrade; 3; 2; 0; 7\nPedro Reis; 6" });
    p(T, "/api/caixa/troco", { valor: 1e4 });
    p(D, "/api/vouchers", { cliente: "Rosa Andrade", tipo: "cortesia", valor: 1, motivo: "anivers\xE1rio" });
    const entradas = [
      ["1", 3, 1, 0, "", "08:05"],
      ["2", 2, 0, 0, "Marcos", "08:12"],
      ["3", 4, 2, 1, "Fam\xEDlia Souza", "08:20"],
      ["4", 2, 0, 0, "", "08:41"],
      ["5", 5, 1, 1, "", "08:55", 1],
      ["6", 2, 0, 0, "", "09:10"],
      ["7", 6, 2, 0, "Turma do futebol", "09:18"],
      ["8", 2, 1, 0, "", "09:34"],
      ["9", 4, 0, 0, "", "09:47"],
      ["10", 2, 0, 1, "Casal Lima", "10:05", 3],
      ["11", 3, 0, 0, "", "10:22"],
      ["12", 2, 2, 0, "", "10:40"]
    ];
    for (const [numero, adultos, criancas, menores, nome, , reserva] of entradas) {
      p(T, "/api/comandas", { numero, adultos, criancas, menores, nome, ...reserva ? { reserva_id: reserva } : {} });
    }
    const pagos = [
      [1, "pix", 19500, "09:20"],
      [2, "dinheiro", 11e3, "09:35"],
      [3, "cartao", 28e3, "09:50"],
      [4, "pix", 11e3, "10:10"],
      [6, "cartao", 11e3, "10:30"]
    ];
    for (const [id, forma, valor] of pagos) {
      p(T, `/api/comandas/${id}/pagamentos`, { forma, valor });
      p(T, `/api/comandas/${id}/fechar`, {});
    }
    p(T, "/api/caixa/movimentos", { tipo: "retirada", valor: 5e3, quem: "Dono", motivo: "pagar o rapaz das cadeiras" });
    const iso = (h) => (/* @__PURE__ */ new Date(`${hoje()}T${h}:00-03:00`)).toISOString();
    entradas.forEach(([, , , , , h, reserva], i) => {
      db.prepare("UPDATE comandas SET aberta_em = ? WHERE id = ?").run(iso(h), i + 1);
      if (reserva) db.prepare("UPDATE reservas SET chegou_em = ? WHERE id = ?").run(iso(h), reserva);
    });
    for (const [id, , , h] of pagos) {
      db.prepare("UPDATE comandas SET fechada_em = ? WHERE id = ?").run(iso(h), id);
      db.prepare("UPDATE pagamentos SET em = ? WHERE comanda_id = ?").run(iso(h), id);
    }
    db.prepare("DELETE FROM sessoes").run();
    salvar();
  }
  var pronto = initSqlJs({ locateFile: (f) => f }).then((SQL) => {
    const salvo = ler();
    const valido = salvo && salvo.dia === hoje();
    preparar(SQL, valido ? deBase64(salvo.banco) : null);
    db = abrir(":memory:");
    app = criarApp(db);
    if (!valido) {
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
      } catch {
      }
      semearExemplo();
    }
  });
  var fetchOriginal = window.fetch.bind(window);
  window.fetch = async (endereco, op = {}) => {
    const url = typeof endereco === "string" ? endereco : endereco.url;
    if (!new URL(url, location.href).pathname.includes("/api/")) return fetchOriginal(endereco, op);
    await pronto;
    const { resposta } = servir((op.method || "GET").toUpperCase(), url, new Headers(op.headers), op.body);
    return new Response(resposta.corpo, { status: resposta.status, headers: { "Content-Type": "application/json" } });
  };
  window.EventSource = class {
    constructor(url) {
      this.url = url;
      this.fechar = [];
      pronto.then(() => {
        const fonte = this;
        const res = {
          set() {
          },
          flushHeaders() {
          },
          status() {
            return this;
          },
          json() {
            setTimeout(() => fonte.onerror?.(), 0);
          },
          write(trecho) {
            for (const linha of trecho.split("\n")) {
              if (linha.startsWith("data: ")) setTimeout(() => fonte.onmessage?.({ data: linha.slice(6) }), 0);
            }
          }
        };
        this.fechar = servir("GET", url, new Headers(), null, res).fechar;
        setTimeout(() => this.onopen?.(), 0);
      });
    }
    close() {
      for (const fn of this.fechar) fn();
    }
  };
  document.addEventListener("DOMContentLoaded", () => {
    const selo = document.createElement("div");
    selo.className = "selo-demo";
    selo.innerHTML = '<b>Demonstra\xE7\xE3o</b><span class="selo-mais"> \xB7 dados de exemplo \xB7 senhas: Dono 1234, Julliana 1111, P\xE1tio 2222</span> \xB7 <button type="button">recome\xE7ar</button>';
    selo.querySelector("button").onclick = () => {
      try {
        localStorage.removeItem(CHAVE);
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
      } catch {
      }
      location.reload();
    };
    document.body.appendChild(selo);
  });
})();
