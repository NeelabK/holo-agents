import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import axios from 'axios';
import cors from 'cors';
import { Connection, PublicKey } from "@solana/web3.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 3000;

// The Ultravox API base URL
const ULTRAVOX_API_URL = 'https://api.ultravox.ai/api/calls';

// The API key is read from the .env file (see .env.example)
const API_KEY = process.env.ULTRAVOX_API_KEY;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});

// Token-gating settings, read from the .env file (see .env.example)
const ACCESS_TOKEN_MINT = process.env.ACCESS_TOKEN_MINT;
const MIN_TOKEN_BALANCE = Number(process.env.MIN_TOKEN_BALANCE || 0);
// Wallets that skip the token check (comma-separated), e.g. for testing
const BYPASS_WALLETS = (process.env.BYPASS_WALLETS || '').split(',').map(w => w.trim()).filter(Boolean);

// make a get request endpoint that provides the wallet address and this returns the token accounts
app.get('/checkWallet', async (req, res) => {
    try {
        const connection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`);
        const walletAddress = req.query.walletAddress;
        if (BYPASS_WALLETS.includes(walletAddress)) {
            return res.status(200).json({ hasEnoughHolo: true });
        }
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            new PublicKey(walletAddress),
            { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") } // SPL Token Program
        );
        let hasHolo = false;
        tokenAccounts.value.forEach((account) => {
            if (account.account.data.parsed.info.mint === ACCESS_TOKEN_MINT) {
                console.log("Balance of the token account is:", account.account.data.parsed.info.tokenAmount.uiAmount);
                if (account.account.data.parsed.info.tokenAmount.uiAmount >= MIN_TOKEN_BALANCE) {
                    console.log(`Wallet ${walletAddress} holds enough of the access token`);
                    hasHolo = true;
                }
            }
        });
        // return status 200 with hasHolo value
        res.status(200).json({ hasEnoughHolo: hasHolo });
    } catch (error) {
        console.error('Error fetching wallet address:', error.message);
        res.status(500).json({ error: 'Failed to fetch wallet address', details: error.message });
    }
});

app.post('/startCall', async (req, res) => {
    console.log(`Received request to start call for voice ${req.body.voice}`);
  
    try {
        // Extract systemPrompt from request body, or use a default value
        const { systemPrompt = "You are a helpful assistant.", voice = "Oliver" } = req.body;
  
        const payload = {
            temperature: 0.99,
            voice: voice,
            systemPrompt: systemPrompt,
            maxDuration: '3600s',
            timeExceededMessage: "Wait just a sec.",
        };
  
        // Make the POST request to Ultravox API
        console.log(`About to call Ultravox API with payload: ${JSON.stringify(payload)}`);
        const response = await axios.post(ULTRAVOX_API_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            }
        });
  
        // Return the payload received from the Ultravox API
        console.log(`Received response from Ultravox API: ${JSON.stringify(response.data)}`);
        res.json(response.data);
    } catch (error) {
        console.error('Error calling Ultravox API:', error.message);
        res.status(500).json({ error: 'Failed to start call', details: error.message });
    }
 });