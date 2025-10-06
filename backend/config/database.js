const mongoose = require('mongoose');

class Database {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/brandaocontador_nfe';
      
      console.log('🔄 Conectando ao MongoDB...');
      
      this.connection = await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      console.log('✅ MongoDB conectado com sucesso!');
      console.log(`📊 Banco: ${this.connection.connection.db.databaseName}`);
      
      return this.connection;
    } catch (error) {
      console.error('❌ Erro ao conectar ao MongoDB:', error.message);
      
      if (error.message.includes('ECONNREFUSED')) {
        console.error('💡 Verifique se o MongoDB está rodando na porta 27017');
      }
      
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.disconnect();
        console.log('🔌 Desconectado do MongoDB');
      }
    } catch (error) {
      console.error('❌ Erro ao desconectar do MongoDB:', error.message);
      throw error;
    }
  }

  async limparBanco() {
    try {
      console.log('🧹 Limpando coleções do banco de dados...');
      
      const collections = ['usuarios', 'clientes', 'nfes', 'logs'];
      
      for (const collection of collections) {
        try {
          await this.connection.connection.db.collection(collection).drop();
          console.log(`✅ Coleção ${collection} removida`);
        } catch (error) {
          if (error.code !== 26) { // Collection not found
            console.error(`❌ Erro ao remover coleção ${collection}:`, error.message);
          }
        }
      }
      
      console.log('🧽 Banco de dados limpo com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao limpar banco de dados:', error.message);
      throw error;
    }
  }

  isConnected() {
    return mongoose.connection.readyState === 1;
  }
}

module.exports = new Database();