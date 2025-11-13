/**
 * Serviço de Geração de PDF DANFE
 *
 * Gera PDF do DANFE (Documento Auxiliar da Nota Fiscal Eletrônica)
 * conforme especificações técnicas da SEFAZ e legislação vigente.
 *
 * Baseado no Manual de Orientação do Contribuinte v7.00 - Anexo II DANFE
 * e nas especificações técnicas para impressão do DANFE NFe 4.0
 */

const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

class DanfeService {
  constructor() {
    this.DANFE_DIR = path.join(__dirname, "../pdfs");
    this.LOGO_PATH = path.join(__dirname, "../assets/logo.png");

    // Cria diretório se não existir
    if (!fs.existsSync(this.DANFE_DIR)) {
      fs.mkdirSync(this.DANFE_DIR, { recursive: true });
    }

    // Configurações do DANFE conforme legislação
    this.config = {
      // Tamanho A4 em pontos (595.28 x 841.89)
      pageSize: "A4",
      margins: {
        top: 20,
        bottom: 20,
        left: 20,
        right: 20,
      },
      // Fontes conforme especificação
      fonts: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italic: "Helvetica-Oblique",
      },
      // Cores conforme padrão
      colors: {
        black: "#000000",
        gray: "#666666",
        lightGray: "#CCCCCC",
        border: "#000000",
      },
    };
  }

  /**
   * Gera PDF DANFE a partir dos dados da NFe
   * Conforme Manual de Orientação do Contribuinte v7.00 - Anexo II DANFE
   * @param {Object} dadosNfe - Dados completos da NFe
   * @param {string} xmlAssinado - XML assinado da NFe
   * @returns {Promise<string>} - Caminho do arquivo PDF gerado
   */
  async gerarDanfe(dadosNfe, xmlAssinado) {
    try {
      console.log("📄 Iniciando geração do DANFE conforme legislação...");

      const nomeArquivo = `DANFE_${dadosNfe.numero}_${Date.now()}.pdf`;
      const caminhoArquivo = path.join(this.DANFE_DIR, nomeArquivo);

      // Gera chave de acesso para QR Code e código de barras
      const chaveAcesso = this.gerarChaveAcesso(dadosNfe);

      // Gera QR Code conforme especificação (mínimo 25mm x 25mm)
      const qrCodeDataURL = await this.gerarQRCode(dadosNfe, chaveAcesso);

      // Cria documento PDF conforme especificações técnicas
      const doc = new PDFDocument({
        size: this.config.pageSize,
        margins: this.config.margins,
        info: {
          Title: `DANFE - NFe ${dadosNfe.numero}`,
          Author: dadosNfe.emitente?.nome || "Sistema NFe",
          Subject: "Documento Auxiliar da Nota Fiscal Eletrônica",
          Keywords: "NFe, DANFE, Nota Fiscal Eletrônica",
          Creator: "Sistema NFe - Conforme Legislação SEFAZ",
        },
      });

      // Stream para arquivo
      const stream = fs.createWriteStream(caminhoArquivo);
      doc.pipe(stream);

      // Gera conteúdo do DANFE conforme layout oficial
      await this.gerarCabecalhoOficial(doc, dadosNfe);
      await this.gerarIdentificacaoNfe(
        doc,
        dadosNfe,
        chaveAcesso,
        qrCodeDataURL,
      );
      await this.gerarDadosEmitente(doc, dadosNfe.emitente);
      await this.gerarDadosDestinatario(doc, dadosNfe.destinatario);
      await this.gerarDadosEntrega(doc, dadosNfe.entrega);
      await this.gerarItensDetalhados(doc, dadosNfe.itens);
      await this.gerarCalculoImposto(doc, dadosNfe.totais);
      await this.gerarTransporteVolumes(doc, dadosNfe.transporte);
      await this.gerarDadosAdicionais(doc, dadosNfe);
      await this.gerarCodigoBarras(doc, chaveAcesso);

      // Adiciona marca d'água se ambiente de homologação
      if (dadosNfe.ambiente === 2) {
        this.adicionarMarcaHomologacao(doc);
      }

      // Finaliza documento
      doc.end();

      // Aguarda conclusão da escrita
      await new Promise((resolve, reject) => {
        stream.on("finish", resolve);
        stream.on("error", reject);
      });

      console.log("✅ DANFE gerado conforme legislação SEFAZ:", caminhoArquivo);
      return caminhoArquivo;
    } catch (error) {
      console.error("❌ Erro ao gerar DANFE:", error);
      throw error;
    }
  }

  /**
   * Gera chave de acesso da NFe conforme padrão SEFAZ
   * @param {Object} dadosNfe - Dados da NFe
   * @returns {string} - Chave de acesso de 44 dígitos
   */
  gerarChaveAcesso(dadosNfe) {
    try {
      // Formato: UF + AAMM + CNPJ + MOD + SERIE + NUMERO + TPEMIS + CODIGO + DV
      const uf = dadosNfe.emitente?.endereco?.codigoUf || "35"; // SP como padrão
      const aamm =
        new Date().getFullYear().toString().substr(2) +
        (new Date().getMonth() + 1).toString().padStart(2, "0");
      const cnpj = (dadosNfe.emitente?.cnpj || "")
        .replace(/\D/g, "")
        .padStart(14, "0");
      const modelo = "55"; // NFe
      const serie = dadosNfe.serie.toString().padStart(3, "0");
      const numero = dadosNfe.numero.toString().padStart(9, "0");
      const tipoEmissao = "1"; // Normal
      const codigo = Math.floor(Math.random() * 100000000)
        .toString()
        .padStart(8, "0");

      const chaveSemDv =
        uf + aamm + cnpj + modelo + serie + numero + tipoEmissao + codigo;
      const dv = this.calcularDigitoVerificador(chaveSemDv);

      return chaveSemDv + dv;
    } catch (error) {
      console.error("Erro ao gerar chave de acesso:", error);
      return "0".repeat(44); // Chave padrão em caso de erro
    }
  }

  /**
   * Calcula dígito verificador da chave de acesso
   * @param {string} chave - Chave sem dígito verificador
   * @returns {string} - Dígito verificador
   */
  calcularDigitoVerificador(chave) {
    const sequencia = "4329876543298765432987654329876543298765432";
    let soma = 0;

    for (let i = 0; i < chave.length; i++) {
      soma += parseInt(chave[i]) * parseInt(sequencia[i]);
    }

    const resto = soma % 11;
    return resto < 2 ? "0" : (11 - resto).toString();
  }

  /**
   * Gera QR Code conforme especificação SEFAZ
   * Tamanho mínimo: 25mm x 25mm (aproximadamente 71x71 pixels a 72 DPI)
   * @param {Object} dadosNfe - Dados da NFe
   * @param {string} chaveAcesso - Chave de acesso da NFe
   * @returns {Promise<string>} - Data URL do QR Code
   */
  async gerarQRCode(dadosNfe, chaveAcesso) {
    try {
      // URL para consulta da NFe conforme padrão SEFAZ
      const urlConsulta = `https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?chNFe=${chaveAcesso}`;

      // Dados para QR Code conforme especificação
      const dadosQR = [
        chaveAcesso,
        urlConsulta,
        dadosNfe.numero,
        dadosNfe.serie,
        dadosNfe.totais?.valorTotal || "0.00",
        dadosNfe.destinatario?.documento || "",
        new Date().toISOString().split("T")[0], // Data emissão
      ].join("|");

      // Gera QR Code com tamanho mínimo conforme legislação
      const qrCodeDataURL = await QRCode.toDataURL(dadosQR, {
        width: 100, // Tamanho mínimo 25mm
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      return qrCodeDataURL;
    } catch (error) {
      console.error("Erro ao gerar QR Code:", error);
      return null;
    }
  }

  /**
   * Gera cabeçalho oficial do DANFE conforme legislação
   */
  async gerarCabecalhoOficial(doc, dadosNfe) {
    const y = 30;

    // Título principal conforme especificação
    doc
      .fontSize(16)
      .font(this.config.fonts.bold)
      .text("DANFE", 50, y, { align: "left" });

    doc
      .fontSize(8)
      .font(this.config.fonts.normal)
      .text("Documento Auxiliar da Nota Fiscal Eletrônica", 50, y + 20);

    // Tipo de operação e ambiente
    const tipoOperacao = dadosNfe.tipoOperacao === "0" ? "ENTRADA" : "SAÍDA";
    const ambiente = dadosNfe.ambiente === 2 ? "HOMOLOGAÇÃO" : "PRODUÇÃO";

    doc
      .fontSize(12)
      .font(this.config.fonts.bold)
      .text(`${dadosNfe.tipoOperacao || "1"} - ${tipoOperacao}`, 350, y, {
        align: "center",
      });

    doc
      .fontSize(8)
      .font(this.config.fonts.normal)
      .text(`Ambiente: ${ambiente}`, 350, y + 15, { align: "center" });

    // Número da NFe
    doc
      .fontSize(14)
      .font(this.config.fonts.bold)
      .text(`Nº ${dadosNfe.numero}`, 350, y + 30, { align: "center" });

    // Série
    doc
      .fontSize(10)
      .text(`SÉRIE ${dadosNfe.serie}`, 350, y + 50, { align: "center" });

    // Caixa ao redor do tipo de operação
    doc.rect(320, y - 5, 150, 70).stroke();

    return y + 80;
  }

  /**
   * Gera seção de identificação da NFe com chave de acesso e QR Code
   */
  async gerarIdentificacaoNfe(doc, dadosNfe, chaveAcesso, qrCodeDataURL) {
    const y = 120;

    // Título da seção
    doc.fontSize(8).font(this.config.fonts.bold).text("CHAVE DE ACESSO", 50, y);

    // Chave de acesso formatada
    const chaveFormatada = chaveAcesso.replace(/(\d{4})/g, "$1 ").trim();
    doc
      .fontSize(10)
      .font(this.config.fonts.normal)
      .text(chaveFormatada, 50, y + 12);

    // QR Code (se disponível)
    if (qrCodeDataURL) {
      try {
        const qrBuffer = Buffer.from(qrCodeDataURL.split(",")[1], "base64");
        doc.image(qrBuffer, 400, y - 10, { width: 80, height: 80 });

        doc
          .fontSize(7)
          .text("Consulte pela chave de acesso em:", 400, y + 75)
          .text("www.nfe.fazenda.gov.br", 400, y + 85);
      } catch (error) {
        console.warn("⚠️ Erro ao inserir QR Code:", error.message);
      }
    }

    // Protocolo de autorização (se disponível)
    if (dadosNfe.protocolo) {
      doc
        .fontSize(8)
        .font(this.config.fonts.bold)
        .text("PROTOCOLO DE AUTORIZAÇÃO DE USO", 50, y + 35);

      doc
        .fontSize(9)
        .font(this.config.fonts.normal)
        .text(
          `${dadosNfe.protocolo} - ${dadosNfe.dataAutorizacao || new Date().toLocaleString()}`,
          50,
          y + 47,
        );
    }

    // Caixa ao redor
    doc.rect(50, y - 5, 495, 70).stroke();

    return y + 80;
  }

  /**
   * Gera dados do emitente conforme especificação SEFAZ
   */
  async gerarDadosEmitente(doc, emitente) {
    const y = 210;

    // Título da seção
    doc.fontSize(8).font(this.config.fonts.bold).text("EMITENTE", 50, y);

    // Logo (se existir) - posição conforme layout oficial
    if (fs.existsSync(this.LOGO_PATH)) {
      try {
        doc.image(this.LOGO_PATH, 55, y + 10, { width: 60, height: 45 });
      } catch (error) {
        console.warn("⚠️ Erro ao carregar logo:", error.message);
      }
    }

    // Dados do emitente - campos obrigatórios conforme legislação
    const xDados = 125;
    doc
      .fontSize(10)
      .font(this.config.fonts.bold)
      .text(emitente.nome || emitente.razaoSocial || "", xDados, y + 10);

    doc
      .fontSize(8)
      .font(this.config.fonts.normal)
      .text(
        `${emitente.endereco?.logradouro || ""}, ${emitente.endereco?.numero || ""}`,
        xDados,
        y + 25,
      )
      .text(`${emitente.endereco?.complemento || ""}`, xDados, y + 35)
      .text(
        `${emitente.endereco?.bairro || ""} - ${emitente.endereco?.municipio || ""} - ${emitente.endereco?.uf || ""}`,
        xDados,
        y + 45,
      )
      .text(
        `CEP: ${this.formatarCep(emitente.endereco?.cep)} - Fone: ${emitente.telefone || ""}`,
        xDados,
        y + 55,
      );

    // CNPJ/IE - campos obrigatórios
    doc
      .fontSize(8)
      .text(`CNPJ: ${this.formatarCnpj(emitente.cnpj)}`, xDados, y + 70)
      .text(
        `IE: ${emitente.inscricaoEstadual || "ISENTO"}`,
        xDados + 120,
        y + 70,
      );

    // Inscrição Municipal (se aplicável)
    if (emitente.inscricaoMunicipal) {
      doc.text(`IM: ${emitente.inscricaoMunicipal}`, xDados + 240, y + 70);
    }

    // CNAE (se disponível)
    if (emitente.cnae) {
      doc.fontSize(7).text(`CNAE: ${emitente.cnae}`, xDados, y + 82);
    }

    // Regime tributário
    const regimeTributario = this.obterRegimeTributario(emitente.crt);
    doc
      .fontSize(7)
      .text(`Regime Tributário: ${regimeTributario}`, xDados + 120, y + 82);

    // Caixa ao redor
    doc.rect(50, y, 495, 85).stroke();

    return y + 95;
  }

  /**
   * Gera dados do destinatário conforme especificação SEFAZ
   */
  async gerarDadosDestinatario(doc, destinatario) {
    const y = 315;

    // Título da seção
    doc
      .fontSize(8)
      .font(this.config.fonts.bold)
      .text("DESTINATÁRIO / REMETENTE", 50, y);

    // Nome/Razão Social
    doc
      .fontSize(8)
      .font(this.config.fonts.normal)
      .text(
        `Nome/Razão Social: ${destinatario.nome || destinatario.razaoSocial || ""}`,
        55,
        y + 12,
      );

    // CNPJ/CPF e Data de Emissão
    const documento = this.formatarDocumento(
      destinatario.cnpj || destinatario.cpf,
    );
    const dataEmissao = this.formatarDataHora(new Date());

    doc
      .text(`CNPJ/CPF: ${documento}`, 55, y + 25)
      .text(`Data de Emissão: ${dataEmissao}`, 300, y + 25);

    // Data de Saída/Entrada e Hora
    doc
      .text(
        `Data de Saída/Entrada: ${this.formatarData(new Date())}`,
        55,
        y + 38,
      )
      .text(
        `Hora de Saída/Entrada: ${this.formatarHora(new Date())}`,
        300,
        y + 38,
      );

    // Endereço completo
    if (destinatario.endereco) {
      doc
        .text(
          `Endereço: ${destinatario.endereco.logradouro || ""}, ${destinatario.endereco.numero || ""}`,
          55,
          y + 51,
        )
        .text(
          `Bairro/Distrito: ${destinatario.endereco.bairro || ""}`,
          55,
          y + 64,
        )
        .text(
          `Município: ${destinatario.endereco.municipio || ""}`,
          200,
          y + 64,
        )
        .text(`Fone/Fax: ${destinatario.telefone || ""}`, 350, y + 64)
        .text(`UF: ${destinatario.endereco.uf || ""}`, 450, y + 64)
        .text(
          `CEP: ${this.formatarCep(destinatario.endereco.cep)}`,
          480,
          y + 64,
        );

      // Inscrição Estadual
      if (destinatario.inscricaoEstadual) {
        doc.text(`IE: ${destinatario.inscricaoEstadual}`, 55, y + 77);
      }
    }

    // Caixa ao redor
    doc.rect(50, y, 495, 75).stroke();

    return y + 85;
  }

  /**
   * Gera dados de entrega (se diferentes do destinatário)
   */
  async gerarDadosEntrega(doc, entrega) {
    if (!entrega || !entrega.endereco) {
      return 0; // Não há dados de entrega
    }

    const y = 410;

    // Título da seção
    doc
      .fontSize(8)
      .font(this.config.fonts.bold)
      .text("LOCAL DE ENTREGA", 50, y);

    // Dados de entrega
    doc
      .fontSize(8)
      .font(this.config.fonts.normal)
      .text(`Nome/Razão Social: ${entrega.nome || ""}`, 55, y + 12)
      .text(
        `CNPJ/CPF: ${this.formatarDocumento(entrega.cnpj || entrega.cpf)}`,
        55,
        y + 25,
      )
      .text(
        `Endereço: ${entrega.endereco.logradouro}, ${entrega.endereco.numero}`,
        55,
        y + 38,
      )
      .text(`Bairro: ${entrega.endereco.bairro}`, 55, y + 51)
      .text(`Município: ${entrega.endereco.municipio}`, 200, y + 51)
      .text(`UF: ${entrega.endereco.uf}`, 350, y + 51)
      .text(`CEP: ${this.formatarCep(entrega.endereco.cep)}`, 400, y + 51);

    // Caixa ao redor
    doc.rect(50, y, 495, 50).stroke();

    return y + 60;
  }

  /**
   * Gera seção de itens detalhados conforme legislação
   */
  async gerarItensDetalhados(doc, itens) {
    if (!itens || itens.length === 0) return 0;

    const y = 480;
    const alturaLinha = 12;

    // Cabeçalho da tabela
    doc
      .fontSize(7)
      .font(this.config.fonts.bold)
      .text("DADOS DOS PRODUTOS / SERVIÇOS", 50, y);

    // Cabeçalhos das colunas
    const yHeader = y + 15;
    doc
      .fontSize(6)
      .text("CÓDIGO", 55, yHeader)
      .text("DESCRIÇÃO DO PRODUTO/SERVIÇO", 100, yHeader)
      .text("NCM/SH", 280, yHeader)
      .text("CST", 320, yHeader)
      .text("CFOP", 340, yHeader)
      .text("UN", 370, yHeader)
      .text("QTDE", 385, yHeader)
      .text("VL UNIT", 415, yHeader)
      .text("VL TOTAL", 455, yHeader)
      .text("BC ICMS", 495, yHeader)
      .text("VL ICMS", 525, yHeader);

    // Linha separadora do cabeçalho
    doc
      .moveTo(50, yHeader + 10)
      .lineTo(545, yHeader + 10)
      .stroke();

    // Itens
    let yAtual = yHeader + 15;

    itens.forEach((item, index) => {
      if (yAtual > 700) {
        // Nova página se necessário
        doc.addPage();
        yAtual = 50;
      }

      doc
        .fontSize(6)
        .font(this.config.fonts.normal)
        .text(item.codigo || "", 55, yAtual, { width: 40 })
        .text(item.descricao || "", 100, yAtual, { width: 175 })
        .text(item.ncm || "", 280, yAtual, { width: 35 })
        .text(item.cst || "", 320, yAtual, { width: 15 })
        .text(item.cfop || "", 340, yAtual, { width: 25 })
        .text(item.unidade || "", 370, yAtual, { width: 10 })
        .text(this.formatarQuantidade(item.quantidade), 385, yAtual, {
          width: 25,
          align: "right",
        })
        .text(this.formatarMoeda(item.valorUnitario), 415, yAtual, {
          width: 35,
          align: "right",
        })
        .text(this.formatarMoeda(item.valorTotal), 455, yAtual, {
          width: 35,
          align: "right",
        })
        .text(this.formatarMoeda(item.baseCalculoIcms), 495, yAtual, {
          width: 25,
          align: "right",
        })
        .text(this.formatarMoeda(item.valorIcms), 525, yAtual, {
          width: 20,
          align: "right",
        });

      yAtual += alturaLinha;
    });

    // Caixa ao redor da tabela
    doc.rect(50, y, 495, yAtual - y + 5).stroke();

    return yAtual + 15;
  }

  /**
   * Gera cálculo de impostos conforme legislação
   */
  async gerarCalculoImposto(doc, totais) {
    const y = 650;

    // Título da seção
    doc
      .fontSize(8)
      .font(this.config.fonts.bold)
      .text("CÁLCULO DO IMPOSTO", 50, y);

    // Base de cálculo do ICMS
    doc
      .fontSize(7)
      .font(this.config.fonts.normal)
      .text("BASE DE CÁLCULO DO ICMS", 55, y + 15)
      .text(this.formatarMoeda(totais?.baseCalculoIcms || 0), 55, y + 25, {
        align: "center",
        width: 80,
      });

    // Valor do ICMS
    doc
      .text("VALOR DO ICMS", 140, y + 15)
      .text(this.formatarMoeda(totais?.valorIcms || 0), 140, y + 25, {
        align: "center",
        width: 80,
      });

    // Base de cálculo ICMS ST
    doc
      .text("BASE DE CÁLCULO DO ICMS ST", 225, y + 15)
      .text(this.formatarMoeda(totais?.baseCalculoIcmsSt || 0), 225, y + 25, {
        align: "center",
        width: 80,
      });

    // Valor ICMS ST
    doc
      .text("VALOR DO ICMS ST", 310, y + 15)
      .text(this.formatarMoeda(totais?.valorIcmsSt || 0), 310, y + 25, {
        align: "center",
        width: 80,
      });

    // Valor total dos produtos
    doc
      .text("VALOR TOTAL DOS PRODUTOS", 395, y + 15)
      .text(this.formatarMoeda(totais?.valorProdutos || 0), 395, y + 25, {
        align: "center",
        width: 80,
      });

    // Segunda linha de totais
    doc
      .text("VALOR DO FRETE", 55, y + 45)
      .text(this.formatarMoeda(totais?.valorFrete || 0), 55, y + 55, {
        align: "center",
        width: 80,
      });

    doc
      .text("VALOR DO SEGURO", 140, y + 45)
      .text(this.formatarMoeda(totais?.valorSeguro || 0), 140, y + 55, {
        align: "center",
        width: 80,
      });

    doc
      .text("DESCONTO", 225, y + 45)
      .text(this.formatarMoeda(totais?.valorDesconto || 0), 225, y + 55, {
        align: "center",
        width: 80,
      });

    doc
      .text("OUTRAS DESPESAS", 310, y + 45)
      .text(this.formatarMoeda(totais?.outrasDespesas || 0), 310, y + 55, {
        align: "center",
        width: 80,
      });

    doc
      .text("VALOR DO IPI", 395, y + 45)
      .text(this.formatarMoeda(totais?.valorIpi || 0), 395, y + 55, {
        align: "center",
        width: 80,
      });

    // Valor total da nota
    doc
      .fontSize(9)
      .font(this.config.fonts.bold)
      .text("VALOR TOTAL DA NOTA", 480, y + 45)
      .text(this.formatarMoeda(totais?.valorTotal || 0), 480, y + 55, {
        align: "center",
        width: 80,
      });

    // Caixas ao redor
    doc.rect(50, y, 495, 75).stroke();

    // Separadores verticais
    for (let i = 1; i < 6; i++) {
      const x = 50 + i * 85;
      doc
        .moveTo(x, y)
        .lineTo(x, y + 75)
        .stroke();
    }

    // Separador horizontal
    doc
      .moveTo(50, y + 40)
      .lineTo(545, y + 40)
      .stroke();

    return y + 85;
  }

  /**
   * Gera dados de transporte e volumes
   */
  async gerarTransporteVolumes(doc, transporte) {
    const y = 745;

    // Título da seção
    doc
      .fontSize(8)
      .font(this.config.fonts.bold)
      .text("TRANSPORTADOR / VOLUMES TRANSPORTADOS", 50, y);

    // Dados do transportador
    if (transporte && transporte.transportador) {
      const transp = transporte.transportador;

      doc
        .fontSize(7)
        .font(this.config.fonts.normal)
        .text(`Nome/Razão Social: ${transp.nome || ""}`, 55, y + 12)
        .text(
          `Frete por conta: ${this.obterModalidadeFrete(transporte.modalidadeFrete)}`,
          55,
          y + 25,
        )
        .text(
          `CNPJ/CPF: ${this.formatarDocumento(transp.cnpj || transp.cpf)}`,
          200,
          y + 12,
        )
        .text(`Código ANTT: ${transp.codigoAntt || ""}`, 200, y + 25)
        .text(`Placa do Veículo: ${transp.placa || ""}`, 350, y + 12)
        .text(`UF: ${transp.ufPlaca || ""}`, 350, y + 25)
        .text(`IE: ${transp.inscricaoEstadual || ""}`, 450, y + 12);
    }

    // Volumes
    if (transporte && transporte.volumes) {
      doc
        .fontSize(7)
        .text("VOLUMES:", 55, y + 40)
        .text(`Quantidade: ${transporte.volumes.quantidade || 0}`, 55, y + 52)
        .text(`Espécie: ${transporte.volumes.especie || ""}`, 150, y + 52)
        .text(`Marca: ${transporte.volumes.marca || ""}`, 250, y + 52)
        .text(
          `Peso Líquido: ${transporte.volumes.pesoLiquido || 0} kg`,
          350,
          y + 52,
        )
        .text(
          `Peso Bruto: ${transporte.volumes.pesoBruto || 0} kg`,
          450,
          y + 52,
        );
    }

    // Caixa ao redor
    doc.rect(50, y, 495, 70).stroke();

    return y + 80;
  }

  /**
   * Gera dados adicionais e observações fiscais
   */
  async gerarDadosAdicionais(doc, dadosNfe) {
    const y = 835;

    // Título da seção
    doc
      .fontSize(8)
      .font(this.config.fonts.bold)
      .text("DADOS ADICIONAIS", 50, y);

    // Informações complementares
    let observacoes = dadosNfe.observacoes || dadosNfe.observacoesFiscais || "";

    // Adiciona informações tributárias conforme Lei 12.741/2012
    if (dadosNfe.totais?.vTotTrib) {
      observacoes += `\nTributos incidentes conforme Lei 12.741/2012: ${this.formatarMoeda(dadosNfe.totais.vTotTrib)}`;
    }

    // Informações do contribuinte
    doc
      .fontSize(7)
      .font(this.config.fonts.normal)
      .text("INFORMAÇÕES COMPLEMENTARES:", 55, y + 12)
      .text(observacoes, 55, y + 25, { width: 240, height: 50 });

    // Reservado ao fisco
    doc.text("RESERVADO AO FISCO:", 310, y + 12);

    // Caixa ao redor
    doc.rect(50, y, 495, 65).stroke();

    // Separador vertical
    doc
      .moveTo(300, y)
      .lineTo(300, y + 65)
      .stroke();

    return y + 75;
  }

  /**
   * Obtém descrição da modalidade do frete
   */
  obterModalidadeFrete(modalidade) {
    const modalidades = {
      0: "(0) Por conta do emitente",
      1: "(1) Por conta do destinatário",
      2: "(2) Por conta de terceiros",
      9: "(9) Sem frete",
    };
    return modalidades[modalidade] || "(9) Sem frete";
  }

  /**
   * Gera dados da NFe
   */
  async gerarDadosNfe(doc, dadosNfe) {
    const y = 290;

    // Chave de acesso
    const chaveAcesso = this.gerarChaveAcesso(dadosNfe);

    doc.fontSize(8).font(this.config.fonts.bold).text("CHAVE DE ACESSO", 50, y);

    doc
      .fontSize(10)
      .font(this.config.fonts.normal)
      .text(this.formatarChaveAcesso(chaveAcesso), 50, y + 12);

    // Consulta via QR Code (para NFCe) ou URL
    if (dadosNfe.modelo === "65") {
      await this.gerarQRCode(doc, dadosNfe, y + 30);
    }

    // Informações fiscais
    doc
      .fontSize(8)
      .text(
        `Natureza da Operação: ${dadosNfe.naturezaOperacao || ""}`,
        50,
        y + 80,
      )
      .text(
        `Protocolo de Autorização: ${dadosNfe.protocolo || ""}`,
        300,
        y + 80,
      )
      .text(
        `Data/Hora de Autorização: ${this.formatarDataHora(new Date())}`,
        300,
        y + 95,
      );

    return y + 110;
  }

  /**
   * Gera tabela de itens
   */
  async gerarItens(doc, itens) {
    const y = 420;
    const alturaLinha = 15;

    // Cabeçalho da tabela
    doc.fontSize(8).font(this.config.fonts.bold);

    // Colunas conforme layout oficial
    const colunas = [
      { titulo: "CÓDIGO", x: 55, width: 60 },
      { titulo: "DESCRIÇÃO DO PRODUTO/SERVIÇO", x: 120, width: 180 },
      { titulo: "NCM/SH", x: 305, width: 50 },
      { titulo: "CST", x: 360, width: 30 },
      { titulo: "CFOP", x: 395, width: 35 },
      { titulo: "UN", x: 435, width: 25 },
      { titulo: "QTDE", x: 465, width: 35 },
      { titulo: "VL UNIT", x: 505, width: 40 },
      { titulo: "VL TOTAL", x: 550, width: 45 },
    ];

    // Desenha cabeçalho
    colunas.forEach((col) => {
      doc.text(col.titulo, col.x, y, { width: col.width, align: "center" });
    });

    // Linha do cabeçalho
    doc
      .moveTo(50, y + 12)
      .lineTo(595, y + 12)
      .stroke();

    // Itens
    doc.font(this.config.fonts.normal);
    let yAtual = y + 20;

    itens.forEach((item, index) => {
      if (yAtual > 700) {
        doc.addPage();
        yAtual = 50;
      }

      doc
        .fontSize(7)
        .text(item.codigo || "", 55, yAtual, { width: 60, align: "center" })
        .text(item.descricao || "", 120, yAtual, { width: 180 })
        .text(item.ncm || "", 305, yAtual, { width: 50, align: "center" })
        .text(item.impostos?.icms?.cst || "", 360, yAtual, {
          width: 30,
          align: "center",
        })
        .text(item.cfop || "", 395, yAtual, { width: 35, align: "center" })
        .text(item.unidade || "", 435, yAtual, { width: 25, align: "center" })
        .text(this.formatarNumero(item.quantidade), 465, yAtual, {
          width: 35,
          align: "right",
        })
        .text(this.formatarMoeda(item.valorUnitario), 505, yAtual, {
          width: 40,
          align: "right",
        })
        .text(this.formatarMoeda(item.valorTotal), 550, yAtual, {
          width: 45,
          align: "right",
        });

      yAtual += alturaLinha;
    });

    // Bordas da tabela
    doc.rect(50, y, 545, yAtual - y).stroke();

    return yAtual + 10;
  }

  /**
   * Gera totais da NFe
   */
  async gerarTotais(doc, totais) {
    const y = 600;

    doc
      .fontSize(8)
      .font(this.config.fonts.bold)
      .text("CÁLCULO DO IMPOSTO", 50, y);

    // Primeira linha de totais
    doc
      .fontSize(8)
      .font(this.config.fonts.normal)
      .text(`Base Cálc. ICMS: ${this.formatarMoeda(totais?.vBC)}`, 55, y + 15)
      .text(`Valor ICMS: ${this.formatarMoeda(totais?.vICMS)}`, 150, y + 15)
      .text(
        `Base Cálc. ICMS ST: ${this.formatarMoeda(totais?.vBCST || "0.00")}`,
        245,
        y + 15,
      )
      .text(
        `Valor ICMS ST: ${this.formatarMoeda(totais?.vST || "0.00")}`,
        350,
        y + 15,
      )
      .text(
        `Valor Total Produtos: ${this.formatarMoeda(totais?.vProd)}`,
        450,
        y + 15,
      );

    // Segunda linha de totais
    doc
      .text(`Valor Frete: ${this.formatarMoeda("0.00")}`, 55, y + 30)
      .text(`Valor Seguro: ${this.formatarMoeda("0.00")}`, 150, y + 30)
      .text(`Desconto: ${this.formatarMoeda("0.00")}`, 245, y + 30)
      .text(`Outras Despesas: ${this.formatarMoeda("0.00")}`, 350, y + 30)
      .text(
        `Valor IPI: ${this.formatarMoeda(totais?.vIPI || "0.00")}`,
        450,
        y + 30,
      );

    // Total da NFe
    doc
      .fontSize(10)
      .font(this.config.fonts.bold)
      .text(
        `VALOR TOTAL DA NFe: ${this.formatarMoeda(totais?.vNF)}`,
        350,
        y + 50,
      );

    // Impostos aproximados (Lei da Transparência)
    if (totais?.vTotTrib && parseFloat(totais.vTotTrib) > 0) {
      doc
        .fontSize(8)
        .font(this.config.fonts.normal)
        .text(
          `Valor Aproximado dos Tributos: ${this.formatarMoeda(totais.vTotTrib)} (Lei 12.741/2012)`,
          55,
          y + 70,
        );
    }

    // Caixa ao redor
    doc.rect(50, y, 495, 85).stroke();

    return y + 95;
  }

  /**
   * Gera dados de transporte
   */
  async gerarTransporte(doc, transporte) {
    const y = 710;

    doc
      .fontSize(8)
      .font(this.config.fonts.bold)
      .text("TRANSPORTADOR / VOLUMES TRANSPORTADOS", 50, y);

    if (transporte) {
      doc
        .fontSize(8)
        .font(this.config.fonts.normal)
        .text(`Razão Social: ${transporte.nome || ""}`, 55, y + 15)
        .text(
          `CNPJ/CPF: ${this.formatarDocumento(transporte.cnpj || transporte.cpf)}`,
          300,
          y + 15,
        )
        .text(`Endereço: ${transporte.endereco || ""}`, 55, y + 30)
        .text(`Município: ${transporte.municipio || ""}`, 300, y + 30)
        .text(`UF: ${transporte.uf || ""}`, 450, y + 30)
        .text(`IE: ${transporte.ie || ""}`, 480, y + 30);
    }

    // Modalidade do frete
    doc.text("Modalidade do Frete: (0) Por conta do emitente", 55, y + 45);

    // Caixa ao redor
    doc.rect(50, y, 495, 60).stroke();

    return y + 70;
  }

  /**
   * Gera observações e informações adicionais
   */
  async gerarObservacoes(doc, dadosNfe) {
    const y = 790;

    doc
      .fontSize(8)
      .font(this.config.fonts.bold)
      .text("DADOS ADICIONAIS", 50, y);

    // Informações do contribuinte
    let observacoes = dadosNfe.observacoesFiscais || "";

    // Adiciona informações tributárias se calculadas
    if (dadosNfe.totais?.vTotTrib) {
      observacoes += `\nTributos incidentes conforme Lei 12.741/2012: ${this.formatarMoeda(dadosNfe.totais.vTotTrib)}`;
    }

    doc
      .fontSize(7)
      .font(this.config.fonts.normal)
      .text(observacoes, 55, y + 15, { width: 485, height: 40 });

    // Caixa ao redor
    doc.rect(50, y, 495, 55).stroke();

    return y + 65;
  }

  /**
   * Gera rodapé do DANFE
   */
  async gerarRodape(doc, dadosNfe) {
    const y = 860;

    doc
      .fontSize(6)
      .font(this.config.fonts.italic)
      .text(
        "Este documento foi emitido por sistema próprio conforme legislação vigente.",
        50,
        y,
        { align: "center" },
      )
      .text(`Emitido em: ${this.formatarDataHora(new Date())}`, 50, y + 10, {
        align: "center",
      });
  }

  /**
   * Gera QR Code para NFCe
   */
  async gerarQRCode(doc, dadosNfe, y) {
    try {
      // URL de consulta (exemplo - deve ser configurada por UF)
      const urlConsulta = `https://www.sefaz.ms.gov.br/nfce/qrcode?chNFe=${this.gerarChaveAcesso(dadosNfe)}`;

      // Gera QR Code
      const qrCodeBuffer = await QRCode.toBuffer(urlConsulta, {
        width: 100,
        margin: 1,
      });

      // Adiciona ao PDF
      doc.image(qrCodeBuffer, 450, y, { width: 80, height: 80 });

      doc
        .fontSize(6)
        .text("Consulte pela chave de acesso em:", 450, y + 85)
        .text("www.sefaz.ms.gov.br", 450, y + 95);
    } catch (error) {
      console.warn("⚠️ Erro ao gerar QR Code:", error.message);
    }
  }

  /**
   * Adiciona marca d'água de homologação
   */
  adicionarMarcaHomologacao(doc) {
    doc
      .fontSize(50)
      .fillColor("#FF0000", 0.3)
      .text("HOMOLOGAÇÃO", 100, 400, {
        align: "center",
        angle: 45,
      })
      .fillColor("#000000", 1);
  }

  /**
   * Gera código de barras da chave de acesso
   */
  async gerarCodigoBarras(doc, chaveAcesso) {
    const y = 750;

    // Título
    doc
      .fontSize(7)
      .font(this.config.fonts.bold)
      .text("CHAVE DE ACESSO PARA CONSULTA DE AUTENTICIDADE", 50, y);

    // Chave formatada
    const chaveFormatada = chaveAcesso.replace(/(\d{4})/g, "$1 ").trim();
    doc
      .fontSize(8)
      .font(this.config.fonts.normal)
      .text(chaveFormatada, 50, y + 12);

    // Simulação de código de barras (linhas verticais)
    for (let i = 0; i < 44; i++) {
      const x = 50 + i * 10;
      const altura = parseInt(chaveAcesso[i]) % 2 === 0 ? 15 : 20;
      doc.rect(x, y + 25, 2, altura).fill("#000000");
    }
  }

  // ==================== MÉTODOS AUXILIARES DE FORMATAÇÃO ====================

  /**
   * Obtém descrição do regime tributário
   */
  obterRegimeTributario(crt) {
    const regimes = {
      1: "Simples Nacional",
      2: "Simples Nacional - Excesso",
      3: "Regime Normal",
    };
    return regimes[crt] || "Regime Normal";
  }

  /**
   * Formata CNPJ
   */
  formatarCnpj(cnpj) {
    if (!cnpj) return "";
    const numeros = cnpj.replace(/\D/g, "");
    return numeros.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5",
    );
  }

  /**
   * Formata CPF
   */
  formatarCpf(cpf) {
    if (!cpf) return "";
    const numeros = cpf.replace(/\D/g, "");
    return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  /**
   * Formata documento (CNPJ ou CPF)
   */
  formatarDocumento(documento) {
    if (!documento) return "";
    const numeros = documento.replace(/\D/g, "");

    if (numeros.length === 11) {
      return this.formatarCpf(documento);
    } else if (numeros.length === 14) {
      return this.formatarCnpj(documento);
    }

    return documento;
  }

  /**
   * Formata CEP
   */
  formatarCep(cep) {
    if (!cep) return "";
    const numeros = cep.replace(/\D/g, "");
    return numeros.replace(/(\d{5})(\d{3})/, "$1-$2");
  }

  /**
   * Formata data
   */
  formatarData(data) {
    if (!data) return "";
    return new Date(data).toLocaleDateString("pt-BR");
  }

  /**
   * Formata hora
   */
  formatarHora(data) {
    if (!data) return "";
    return new Date(data).toLocaleTimeString("pt-BR");
  }

  /**
   * Formata data e hora
   */
  formatarDataHora(data) {
    if (!data) return "";
    return new Date(data).toLocaleString("pt-BR");
  }

  /**
   * Formata valor monetário
   */
  formatarMoeda(valor) {
    if (!valor) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(valor));
  }

  /**
   * Formata quantidade
   */
  formatarQuantidade(quantidade) {
    if (!quantidade) return "0,0000";
    return parseFloat(quantidade).toLocaleString("pt-BR", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  }

  /**
   * Formata chave de acesso para exibição
   */
  formatarChaveAcesso(chave) {
    if (!chave) return "";
    return chave.replace(/(\d{4})/g, "$1 ").trim();
  }

  /**
   * Calcula dígito verificador da chave
   */
  calcularDV(chave) {
    const sequencia = "4329876543298765432987654329876543298765432";
    let soma = 0;

    for (let i = 0; i < chave.length; i++) {
      soma += parseInt(chave[i]) * parseInt(sequencia[i]);
    }

    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  /**
   * Formatadores auxiliares
   */
  formatarCnpj(cnpj) {
    if (!cnpj) return "";
    const nums = cnpj.replace(/\D/g, "");
    return nums.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5",
    );
  }

  formatarCpf(cpf) {
    if (!cpf) return "";
    const nums = cpf.replace(/\D/g, "");
    return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  formatarDocumento(doc) {
    if (!doc) return "";
    return doc.length === 11 ? this.formatarCpf(doc) : this.formatarCnpj(doc);
  }

  formatarChaveAcesso(chave) {
    if (!chave) return "";
    return chave.replace(/(\d{4})/g, "$1 ").trim();
  }

  formatarMoeda(valor) {
    if (!valor) return "0,00";
    const num = parseFloat(valor);
    return num.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  formatarNumero(valor) {
    if (!valor) return "0,000";
    const num = parseFloat(valor);
    return num.toLocaleString("pt-BR", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  }

  formatarData(data) {
    return data.toLocaleDateString("pt-BR");
  }

  formatarDataHora(data) {
    return data.toLocaleString("pt-BR");
  }
}

module.exports = DanfeService;
