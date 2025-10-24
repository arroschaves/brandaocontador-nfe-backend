const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Importar todos os modelos
const Usuario = require('./backend/models/Usuario');
const Cliente = require('./backend/models/Cliente');
const Produto = require('./backend/models/Produto');
const NFe = require('./backend/models/NFe');

async function limparSistemaCompleto() {
    try {
        console.log('🔥 INICIANDO LIMPEZA COMPLETA DO SISTEMA...');
        console.log('');

        // Conectar ao MongoDB
        await mongoose.connect('mongodb://localhost:27017/brandaocontador-nfe', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Conectado ao MongoDB');

        // 1. DELETAR TODAS AS COLEÇÕES
        console.log('');
        console.log('🗑️  DELETANDO TODAS AS INFORMAÇÕES...');
        
        // Deletar todos os usuários
        const usuariosRemovidos = await Usuario.deleteMany({});
        console.log(`   ❌ Usuários removidos: ${usuariosRemovidos.deletedCount}`);

        // Deletar todos os clientes
        const clientesRemovidos = await Cliente.deleteMany({});
        console.log(`   ❌ Clientes removidos: ${clientesRemovidos.deletedCount}`);

        // Deletar todos os produtos
        const produtosRemovidos = await Produto.deleteMany({});
        console.log(`   ❌ Produtos removidos: ${produtosRemovidos.deletedCount}`);

        // Deletar todas as NFes
        const nfesRemovidas = await NFe.deleteMany({});
        console.log(`   ❌ NFes removidas: ${nfesRemovidas.deletedCount}`);

        // Limpar outras coleções que possam existir
        const collections = await mongoose.connection.db.listCollections().toArray();
        for (const collection of collections) {
            if (!['usuarios', 'clientes', 'produtos', 'nfes'].includes(collection.name)) {
                await mongoose.connection.db.collection(collection.name).deleteMany({});
                console.log(`   ❌ Coleção '${collection.name}' limpa`);
            }
        }

        console.log('');
        console.log('✅ SISTEMA COMPLETAMENTE LIMPO!');

        // 2. CRIAR USUÁRIO ADMINISTRADOR
        console.log('');
        console.log('👤 CRIANDO USUÁRIO ADMINISTRADOR...');

        const senhaHash = await bcrypt.hash('admin123', 10);
        
        const admin = new Usuario({
            nome: 'Administrador',
            email: 'admin@brandaocontador.com.br',
            senha: senhaHash,
            tipo: 'administrador',
            ativo: true,
            dataCriacao: new Date()
        });

        await admin.save();
        console.log('✅ Usuário administrador criado com sucesso!');
        console.log(`   📧 Email: admin@brandaocontador.com.br`);
        console.log(`   🔑 Senha: admin123`);

        // 3. VERIFICAR ESTADO FINAL
        console.log('');
        console.log('📊 VERIFICANDO ESTADO FINAL...');
        
        const totalUsuarios = await Usuario.countDocuments();
        const totalClientes = await Cliente.countDocuments();
        const totalProdutos = await Produto.countDocuments();
        const totalNFes = await NFe.countDocuments();

        console.log(`   👥 Total de usuários: ${totalUsuarios} (deve ser 1 - apenas admin)`);
        console.log(`   🏢 Total de clientes: ${totalClientes} (deve ser 0)`);
        console.log(`   📦 Total de produtos: ${totalProdutos} (deve ser 0)`);
        console.log(`   📄 Total de NFes: ${totalNFes} (deve ser 0)`);

        console.log('');
        if (totalUsuarios === 1 && totalClientes === 0 && totalProdutos === 0 && totalNFes === 0) {
            console.log('🎉 SISTEMA LIMPO COM SUCESSO!');
            console.log('✅ Apenas usuário administrador presente');
            console.log('✅ Todas as outras informações foram removidas');
        } else {
            console.log('⚠️  ATENÇÃO: Verificar se a limpeza foi completa');
        }

        console.log('');
        console.log('🚀 SISTEMA PRONTO PARA USO!');
        console.log('   Faça login com: admin@brandaocontador.com.br / admin123');
        console.log('   Agora você pode cadastrar o cliente corretamente.');

    } catch (error) {
        console.error('❌ Erro durante a limpeza:', error);
    } finally {
        await mongoose.disconnect();
        console.log('');
        console.log('🔌 Desconectado do MongoDB');
        process.exit(0);
    }
}

// Executar a limpeza
limparSistemaCompleto();