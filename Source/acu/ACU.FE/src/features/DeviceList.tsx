import { useState, useEffect, useCallback, useRef } from 'react';
type Message = {
role: 'patient' | 'assistant';
text: string;
source?: string;
};
const sequence = [
  {
text: 'The CT scan acquisition itself only takes a few seconds. The full process including registration, positioning and preparation usually takes around 10–15 minutes. Please arrive early and stay relaxed.',
source: 'Siemens CT Guide',
  },
  {
text: 'Metal items create artifacts and affect image quality. Please remove necklaces, earrings, rings, hair clips and clothing with metal fasteners. Notify staff if you have non-removable metal implants.',
source: 'Siemens CT Guide',
  },
];
export const DeviceList = () => {
const [messages, setMessages] = useState<Message[]>([
    {
role: 'assistant',
text: 'Hello! I am your CT preparation assistant. Press Start to begin your preparation.',
source: 'Siemens CT Guide',
    },
  ]);
const [isListening, setIsListening] = useState(false);
const [isSpeaking, setIsSpeaking] = useState(false);
const [speechIndex, setSpeechIndex] = useState(-1);
const [mouthOpen, setMouthOpen] = useState(false);

// ========== 背景音乐新增部分 ==========
const bgmRef = useRef<HTMLAudioElement | null>(null);
const [bgmStarted, setBgmStarted] = useState(false);

useEffect(() => {
  // 初始化背景音乐
  bgmRef.current = new Audio("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3");
  bgmRef.current.loop = true;
  bgmRef.current.volume = 0.22; // 音量压低，不盖语音

  return () => {
    // 组件销毁（切走Patient标签）停止音乐
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current = null;
    }
  };
}, []);
// ======================================

// 卡通嘴巴动画，说话时开合
useEffect(() => {
if (!isSpeaking) {
setMouthOpen(false);
return;
    }
const timer = setInterval(() => {
setMouthOpen(prev => !prev);
    }, 350);
return () => clearInterval(timer);
  }, [isSpeaking]);

// 自动顺序播报话术
useEffect(() => {
if (speechIndex < 0 || speechIndex >= sequence.length) {
if (speechIndex === sequence.length) {
setIsSpeaking(false);
setIsListening(true);
      }
return;
    }
setIsSpeaking(true);
const item = sequence[speechIndex];
setMessages(prev => [...prev, { role: 'assistant', text: item.text, source: item.source }]);
// 模拟每条话术间隔，后端对接后这里替换成tts完成回调
const timer = setTimeout(() => {
setSpeechIndex(i => i + 1);
    }, 4200);
return () => clearTimeout(timer);
  }, [speechIndex]);

const handleStart = useCallback(() => {
  // 第一次点击Start，启动背景音乐
  if (!bgmStarted && bgmRef.current) {
    bgmRef.current.play().catch(err => console.log('bgm blocked:', err));
    setBgmStarted(true);
  }
setIsListening(false);
setSpeechIndex(0);
}, [bgmStarted]);

const handleEmergency = useCallback(() => {
setMessages(prev => [
...prev,
      {
role: 'assistant',
text: 'Emergency call triggered. Help is on the way, please stay calm.',
source: 'Siemens CT Guide',
      },
    ]);
}, []);

return (
<div style={{
fontFamily: "'Nunito', sans-serif",
width: '100vw',
height: '100vh',
overflow: 'hidden',
backgroundColor: '#f7fbf9',
position: 'relative',
boxSizing: 'border-box',
padding: '24px',
    }}>
{/* 底部装饰气泡，静态、大、带光泽，不交互 */}
<div style={{ position: 'absolute', bottom: '20px', left: '0', width: '100%', height: '220px', pointerEvents: 'none', zIndex: 1 }}>
<div style={{
position: 'absolute', left: '8%', bottom: '20px', width: '72px', height: '72px', borderRadius: '50%',
background: 'radial-gradient(circle at 30% 30%, #80d8b8, #289972)',
boxShadow: 'inset 0 -8px 14px rgba(0,80,40,0.22), 0 6px 16px rgba(40,153,114,0.3)',
opacity: 0.75,
        }} />
<div style={{
position: 'absolute', left: '24%', bottom: '70px', width: '56px', height: '56px', borderRadius: '50%',
background: 'radial-gradient(circle at 30% 30%, #80d8b8, #289972)',
boxShadow: 'inset 0 -6px 12px rgba(0,80,40,0.22), 0 4px 12px rgba(40,153,114,0.28)',
opacity: 0.68,
        }} />
<div style={{
position: 'absolute', right: '12%', bottom: '32px', width: '84px', height: '84px', borderRadius: '50%',
background: 'radial-gradient(circle at 30% 30%, #80d8b8, #289972)',
boxShadow: 'inset 0 -10px 16px rgba(0,80,40,0.22), 0 8px 18px rgba(40,153,114,0.32)',
opacity: 0.72,
        }} />
<div style={{
position: 'absolute', right: '30%', bottom: '90px', width: '48px', height: '48px', borderRadius: '50%',
background: 'radial-gradient(circle at 30% 30%, #80d8b8, #289972)',
boxShadow: 'inset 0 -5px 10px rgba(0,80,40,0.22), 0 3px 10px rgba(40,153,114,0.25)',
opacity: 0.65,
        }} />
</div>
{/* Header Siemens */}
<div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
<div style={{
width: '48px', height: '48px', borderRadius: '12px',
background: 'linear-gradient(135deg, #0e8b61, #35b98c)',
boxShadow: '0 10px 24px rgba(40,153,114,0.25)',
        }} />
<div>
<p style={{ fontSize: '28px', fontWeight: 700, margin: 0, color: '#0b1f3a' }}>Siemens Healthineers</p>
<p style={{ fontSize: '18px', margin: '4px 0 0', color: '#3b705c' }}>CT Patient Prep Assistant</p>
</div>
</div>
{/* 卡通形象区域 */}
<div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
<div style={{ textAlign: 'center' }}>
<div style={{ fontSize: '90px', lineHeight: 1 }}>
            🦒
<div style={{
marginTop: '-36px', fontSize: '24px',
transform: mouthOpen ? 'scaleY(1)' : 'scaleY(0.4)',
transition: 'transform 0.2s ease',
            }}>
{mouthOpen ? '◡' : '—'}
</div>
</div>
<p style={{ margin: '6px 0', color: '#287056', fontWeight: 600 }}>Gerda</p>
{isListening && (
<div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '8px' }}>
{[0,1,2].map(i => (
<div key={i} style={{
width: '6px', height: `${12 + i*4}px`, backgroundColor: '#289972', borderRadius: '3px',
animation: 'pulse 1s infinite alternate', animationDelay: `${i * 0.2}s`
                }} />
              ))}
</div>
          )}
</div>
</div>
{/* 聊天窗口 */}
<div style={{
height: '36vh', overflowY: 'auto', padding: '16px',
background: '#ffffff', borderRadius: '20px',
boxShadow: '0 8px 24px rgba(22, 90, 64, 0.12)',
marginBottom: '24px',
      }}>
{messages.map((msg, idx) => (
<div key={idx} style={{
display: 'flex', marginBottom: '14px',
justifyContent: msg.role === 'assistant' ? 'flex-start' : 'flex-end',
          }}>
<div style={{
maxWidth: '75%', padding: '14px 18px', borderRadius: '18px',
background: msg.role === 'assistant' ? '#e6f7f1' : '#dcf2ea',
color: '#124734',
boxShadow: '0 3px 8px rgba(40,153,114,0.1)',
            }}>
<p style={{ margin: 0, fontSize: '18px', lineHeight: 1.5 }}>{msg.text}</p>
</div>
</div>
        ))}
</div>
{/* 底部按钮区 */}
<div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
<button
onClick={handleStart}
disabled={isSpeaking || isListening}
style={{
flex: 1, maxWidth: '260px', padding: '24px 16px', fontSize: '22px', fontWeight: 600,
color: '#ffffff', background: 'linear-gradient(135deg, #0e8b61, #35b98c)',
border: 'none', borderRadius: '24px', cursor: 'pointer',
boxShadow: '0 14px 30px rgba(40,153,114,0.28)',
opacity: (isSpeaking || isListening) ? 0.55 : 1,
          }}
>
          Start
</button>
<button
onClick={handleEmergency}
style={{
flex: 1, maxWidth: '260px', padding: '24px 16px', fontSize: '22px', fontWeight: 600,
color: '#ffffff', background: 'linear-gradient(135deg, #c73232, #e85454)',
border: 'none', borderRadius: '24px', cursor: 'pointer',
boxShadow: '0 14px 30px rgba(200,40,40,0.25)',
          }}
>
          Emergency Call
</button>
</div>
<style>{`
        @keyframes pulse {
          from { transform: scaleY(0.6); }
          to { transform: scaleY(1.2); }
        }
      `}</style>
</div>
  );
};
