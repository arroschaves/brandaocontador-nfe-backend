const bcrypt = require('bcrypt');

async function createHash() {
    const senha = '@Pa2684653#';
    const hash = await bcrypt.hash(senha, 12);
    console.log('Hash gerado:', hash);
}

createHash().catch(console.error);
