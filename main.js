import jsyaml from 'js-yaml'; 
import { UltravoxSession } from 'ultravox-client';

const getWalletProvider = () => {
    if (window.solana && window.solana.isPhantom) return window.solana;
    if (window.solflare) return window.solflare;
    if (window.backpack) return window.backpack;
    if (window.sollet) return window.sollet;
    if (window.solong) return window.solong;

    return null; // No supported wallets found
};

let allow = null;
let isMuted = false;
let countdownInterval = null;
let remainingSeconds = 3600;
let uvSession;

const connectWallet = async () => {
    const provider = getWalletProvider();

    if (!provider) {
        // console.log("No compatible Solana wallet found! Please install Phantom, Solflare, or another supported wallet.");
        // throw alert to user
        alert("No compatible Solana wallet found! Supported wallets include Phantom, Solflare, Backpack, Sollet, and Solong.");
        return;
    }

    try {
        const wallet = await provider.connect();
        const walletAddress = wallet.publicKey.toString();

        // console.log(`Connected: ${walletAddress}`);
        // update the text of the button to show the first and last 4 values of the wallet address and say connected
        document.getElementById('wallet-connect').innerText = `CONNECTED ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;

        provider.on('disconnect', () => {
            // console.log('Wallet disconnected');
            document.getElementById('wallet-connect').innerText = 'CONNECT WALLET';
        });

        // call checkWallet endpoint with wallet address as get request parameter
        const response = await fetch(`/checkWallet?walletAddress=${walletAddress}`);
        if (!response.ok) {
            if (response.status === 401) {
                console.error("Unauthorized access - 401");
                alert("This wallet isn't on the access list.");
            } else if (response.status === 500) {
                console.error("Server error - 500");
                alert("Server error. Please try again later.");
            }
            allow = false;
            return;
        }
        const data = await response.json();
        const hasHolo = data.hasEnoughHolo;
        
        if (!hasHolo) {
            alert("This wallet doesn't hold enough of the access token.");
        } else {
            alert("Wallet verified. Pick a character and start a call!");
        }
        allow = hasHolo;
    } catch (error) {
        console.error("Wallet connection failed:", error);
    }
};

//function to get the center name
function getCenterName() {
    const currentHolo = document.getElementById('center-slide');
    //now get center by classs is-active
    // under the element current there is a dic with class name hologram-name, get that
    const holoName = currentHolo.getElementsByClassName('hologram-name')[0].innerText;
    return holoName;
}

document.addEventListener('DOMContentLoaded', async () => {
    // await checkDate();

    // remainingSeconds = localStorage.getItem('t') !== null ? parseInt(localStorage.getItem('t')) : 3600;
    if (remainingSeconds < 0) remainingSeconds = 0;
    updateCountdownDisplay(remainingSeconds, document.getElementById('countdown-timer'));

    const walletConnectButton = document.getElementById('wallet-connect');
    walletConnectButton.addEventListener('click', async () => {
        await connectWallet();
    });

    const startCallButton = document.getElementById('start-call-btn');
    startCallButton.addEventListener('click', async () => {
        const holoName = getCenterName();
        if (allow === null) {
            alert("Please connect your wallet first.");
            return;
        } else if (!allow) {
            alert("This wallet doesn't hold enough of the access token.");
            return;
        } else if (remainingSeconds <= 0) {
            alert("You have run out of time for today. Please wait until tomorrow!");
        } else {
            const voice = voiceMap[holoName];
            const prompt = await getPrompt(voice);
            const joinUrl = await getJoinUrl(prompt, voice);
            await startCall(joinUrl);
            startUI();
        }
    });

    const endCallBtn = document.querySelector('.end-call-btn');
    endCallBtn.addEventListener('click', () => {
        endCall();
    });

    const muteBtn = document.querySelector('.mute-btn');
    muteBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        if (isMuted) {
            uvSession.muteMic();
        } else {
            uvSession.unmuteMic();
        }
        muteBtn.textContent = isMuted ? 'UNMUTE' : 'MUTE';
    });

    // setInterval(() => {
    //     localStorage.setItem('t', remainingSeconds);
    // }, 1000);
});

async function getJoinUrl(systemPrompt, voice) {
    const response = await fetch("/startCall", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            systemPrompt: systemPrompt,
            voice: voice,
        })
    });
  
    if (response.ok) {
        const data = await response.json();
        return data.joinUrl;
    }
}

function endCall() {
    const textButtonWrapper = document.querySelector('.text-button-wrapper');
    const callControlsWrapper = document.querySelector('.call-controls-wrapper');
    const muteBtn = document.querySelector('.mute-btn');

    uvSession.leaveCall();
    callControlsWrapper.style.display = 'none';
    textButtonWrapper.style.display = 'flex';
    // Reset mute state
    isMuted = false;
    muteBtn.textContent = 'MUTE';
    // Re-enable drag without destroying/remounting
    window.splide.options = { drag: true };
    // Pause countdown but keep remaining time
    pauseCountdown();
    const countdownElement = document.getElementById('countdown-timer');
    updateCountdownDisplay(remainingSeconds, countdownElement);
}

async function startCall(joinUrl) {
    try {
        uvSession = new UltravoxSession();
        if (!joinUrl) {
            throw new Error('Join URL is required');
        } else {
            uvSession.joinCall(joinUrl);
        }
    } catch (error) {
        console.error('Error starting call:', error);
    }
}

function startUI() {
    const textButtonWrapper = document.querySelector('.text-button-wrapper');
    const callControlsWrapper = document.querySelector('.call-controls-wrapper');

    textButtonWrapper.style.display = 'none';
    callControlsWrapper.style.display = 'block';
    window.splide.options = { drag: false };
    startCountdown();
}

function startCountdown() {
    const countdownElement = document.getElementById('countdown-timer');

    // Clear any existing interval
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }

    // Update immediately then start interval
    updateCountdownDisplay(remainingSeconds, countdownElement);

    countdownInterval = setInterval(() => {
      remainingSeconds--;

      if (remainingSeconds < 0) {
        // pauseCountdown();
        endCall();
        return;
      }

      updateCountdownDisplay(remainingSeconds, countdownElement);
    }, 1000);
}

function pauseCountdown() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    remainingSeconds = 3600;
}

function updateCountdownDisplay(totalSeconds, element) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    element.textContent = formattedTime;
}

const voiceMap = {
    'Steve Jobs': 'jobs',
    'Marcus Aurelius': 'Oliver',
    'Rick Sanchez': 'rick',
    'Hermione Granger': 'hermione-granger',
    'Mr. Beast': 'beast',
};

async function loadYAML() {
    try {
      const response = await fetch('system_prompts.yaml');
      const yamlText = await response.text();
      return jsyaml.load(yamlText); // Parse YAML to JavaScript object
    } catch (error) {
    //   console.error("Error loading YAML file:", error);
      return null;
    }
}

async function getPrompt(voice) {
    const textarea = document.getElementById("systemPrompt");
  
    const data = await loadYAML();
    if (!data || !data.system_prompts) {
      console.log("Failed to load prompts.");
      return;
    }
  
    const selectedVoice = voice.toLowerCase();
    const selectedPrompt = data.system_prompts[selectedVoice]?.prompt || "Just be an ai agent. Say something went wrong and to contact the Holozone Devs who are the creators of HolozoneAI, a web3 conversational ai agent platform.";

    return selectedPrompt;
}

async function checkDate() {
    const now = new Date();
    const storedDateStr = localStorage.getItem("d");
    if (!storedDateStr) {
        localStorage.setItem("d", now.toISOString());
        return null;
    }
    const storedDate = new Date(storedDateStr);

    const nextMidnight = new Date(
        storedDate.getFullYear(),
        storedDate.getMonth(),
        storedDate.getDate() + 1
    );

    if (now >= nextMidnight) {
        localStorage.setItem("d", now.toISOString());
        localStorage.removeItem("t");
    }
}