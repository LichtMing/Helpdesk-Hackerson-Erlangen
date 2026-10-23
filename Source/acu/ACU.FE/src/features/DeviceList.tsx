import { useState, useEffect, useCallback } from 'react';

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

type Bubble = {
  id: number;
  left: number;
  bottom: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
};

const generateBubbles = (count: number): Bubble[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    left: 8 + Math.random() * 84,
    bottom: 6 + Math.random() * 40,
    size: 24 + Math.random() * 42, // 气泡整体加大
    delay: Math.random() * 6,
    duration: 6 + Math.random() * 5,
    opacity: 0.22 + Math.random() * 0.28, // 提高基础透明度，更明显
  }));
};

export const DeviceList = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: 'Hello! I am your CT preparation assistant. Press Start to begin your CT scan preparation.',
      source: 'Siemens CT Guide',
    },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [bubbles] = useState<Bubble[]>(() => generateBubbles(14));

  const appendAssistantMessage = useCallback((text: string, source?: string) => {
    setMessages(prev => [...prev, { role: 'assistant', text, source }]);
  }, []);

  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) await docEl.requestFullscreen();
      } catch (e) {}
    };
    enterFullscreen();
  }, []);

  const runSequence = useCallback(async () => {
    setIsRunning(true);
    setIsEmergency(false);
    setIsListening(false);
    setMessages(prev => [
      ...prev,
      { role: 'patient', text: 'Start my CT preparation.' },
    ]);

    for (const item of sequence) {
      await new Promise(resolve => setTimeout(resolve, 1800));
      appendAssistantMessage(item.text, item.source);
    }

    await new Promise(resolve => setTimeout(resolve, 1200));
    setIsRunning(false);
    setIsListening(true);
  }, [appendAssistantMessage]);

  const handleEmergency = () => {
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        text: 'Calling emergency support...',
        source: 'Siemens CT Guide',
      },
    ]);
    setIsEmergency(true);
    setIsListening(false);
  };

  return (
    <div
      style={{
        width: '1080px',
        height: '1920px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        margin: '0 auto',
        position: 'relative',
        background: isEmergency
          ? '#4b1c1c'
          : 'radial-gradient(circle at 20% 10%, #eaf2ff 0%, transparent 40%), radial-gradient(circle at 80% 90%, #e6f7ff 0%, transparent 40%), #f7fbff',
        fontFamily: "'Nunito', sans-serif",
        color: '#0b1f3a',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background 0.4s ease',
      }}
    >
      <style>{`
        @keyframes gentleBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes softFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes softPulse {
          0% { transform: scale(0.85); opacity: 0.4; }
          50% { transform: scale(1.05); opacity: 0.75; }
          100% { transform: scale(0.85); opacity: 0.4; }
        }
        .wave-circle {
          animation: softPulse 2.8s ease-in-out infinite;
        }
        /* 角色弹跳 */
        @keyframes bounceSoft {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
        /* 微笑嘴巴开合 */
        @keyframes smileOpenClose {
          0%, 100% { height: 14px; border-radius: 0 0 22px 22px; }
          50% { height: 24px; border-radius: 0 0 34px 34px; }
        }
        /* 小气泡弹跳 */
        @keyframes bounceSmall {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-10px) scale(1.12); }
        }
        /* 气泡破裂动画 */
        @keyframes bubblePop {
          0% { transform: scale(0.6); opacity: 0.25; }
          40% { transform: scale(1.15); opacity: 0.55; }
          60% { transform: scale(1.25); opacity: 0.45; }
          80% { transform: scale(1.45); opacity: 0.25; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        /* 底层漂浮气泡动画 */
        @keyframes floatBubble {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(-6px, -18px, 0) scale(1.08); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
      `}</style>

      {/* 满屏漂浮 带光泽气泡 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {bubbles.map(bubble => (
          <div
            key={bubble.id}
            style={{
              position: 'absolute',
              left: `${bubble.left}%`,
              bottom: `${bubble.bottom}%`,
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85), rgba(128, 203, 196, ${bubble.opacity}) 65%, rgba(65, 182, 196, ${bubble.opacity * 0.75}))`,
              boxShadow: `inset -4px -4px 10px rgba(255,255,255,0.6), inset 3px 3px 8px rgba(0,100,110,0.18)`,
              animation: `floatBubble ${bubble.duration}s ease-in-out infinite`,
              animationDelay: `${bubble.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Listening 遮罩 */}
      {isListening && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.22)',
            zIndex: 99,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              padding: '40px 60px',
              borderRadius: '32px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <div className="wave-circle" style={{ width: '20px', height: '20px', borderRadius: '999px', backgroundColor: '#00897b' }} />
              <div className="wave-circle" style={{ width: '34px', height: '34px', borderRadius: '999px', backgroundColor: '#41b6c4', animationDelay: '0.4s' }} />
              <div className="wave-circle" style={{ width: '48px', height: '48px', borderRadius: '999px', backgroundColor: '#80cbc4', animationDelay: '0.8s' }} />
            </div>
            <p style={{ fontSize: '30px', fontWeight: 700, margin: 0, color: '#00796b' }}>
              Listening...
            </p>
            <p style={{ fontSize: '20px', color: '#4f6785', marginTop: '10px' }}>
              Speak now, I am listening to you
            </p>
          </div>
        </div>
      )}

      {/* 底部嵌入式大号张嘴笑脸CT卡通 + 弹跳 + 光泽气泡破裂 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '30px',
          transform: 'translateX(-50%)',
          width: '760px',
          height: '340px',
          opacity: 0.22,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            gap: '90px',
          }}
        >
          {/* CT角色1：大号张嘴笑脸 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              animation: 'bounceSoft 2.2s ease-in-out infinite',
            }}
          >
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: '50%',
                border: '9px solid #00897b',
                position: 'relative',
                background: 'rgba(255,255,255,0.4)',
              }}
            >
              {/* 左眼 */}
              <div
                style={{
                  position: 'absolute',
                  top: '34px',
                  left: '26px',
                  width: 14,
                  height: 14,
                  backgroundColor: '#004d40',
                  borderRadius: '50%',
                }}
              />
              {/* 右眼 */}
              <div
                style={{
                  position: 'absolute',
                  top: '34px',
                  right: '26px',
                  width: 14,
                  height: 14,
                  backgroundColor: '#004d40',
                  borderRadius: '50%',
                }}
              />
              {/* 张嘴微笑 */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '28px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 46,
                  height: 20,
                  border: '4px solid #004d40',
                  borderTop: 'none',
                  borderRadius: '0 0 30px 30px',
                  animation: 'smileOpenClose 1.6s ease-in-out infinite',
                }}
              />
            </div>
            {/* 机身 */}
            <div
              style={{
                width: 52,
                height: 18,
                backgroundColor: '#00897b',
                marginTop: '-8px',
                borderRadius: '8px',
              }}
            />
            <div
              style={{
                width: 110,
                height: 12,
                backgroundColor: '#41b6c4',
                borderRadius: '999px',
                marginTop: 16,
              }}
            />
            {/* 角色旁光泽气泡 */}
            <div
              style={{
                position: 'absolute',
                left: '-30px',
                bottom: '140px',
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85), rgba(128, 203, 196,0.55) 65%)',
                boxShadow: 'inset -3px -3px 8px rgba(255,255,255,0.6)',
                animation: 'bounceSmall 1.8s ease-in-out infinite 0.3s',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '110px',
                bottom: '180px',
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85), rgba(65, 182, 196,0.5) 65%)',
                boxShadow: 'inset -3px -3px 8px rgba(255,255,255,0.6)',
                animation: 'bounceSmall 1.6s ease-in-out infinite 0.9s',
              }}
            />
          </div>

          {/* CT角色2：大号张嘴笑脸 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              animation: 'bounceSoft 2.4s ease-in-out infinite 0.4s',
            }}
          >
            <div
              style={{
                width: 118,
                height: 118,
                borderRadius: '50%',
                border: '8px solid #41b6c4',
                position: 'relative',
                background: 'rgba(255,255,255,0.35)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '28px',
                  left: '22px',
                  width: 12,
                  height: 12,
                  backgroundColor: '#004d40',
                  borderRadius: '50%',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '28px',
                  right: '22px',
                  width: 12,
                  height: 12,
                  backgroundColor: '#004d40',
                  borderRadius: '50%',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '24px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 38,
                  height: 16,
                  border: '4px solid #004d40',
                  borderTop: 'none',
                  borderRadius: '0 0 26px 26px',
                  animation: 'smileOpenClose 1.6s ease-in-out infinite 0.25s',
                }}
              />
            </div>
            <div
              style={{
                width: 44,
                height: 16,
                backgroundColor: '#41b6c4',
                marginTop: '-7px',
                borderRadius: '7px',
              }}
            />
            <div
              style={{
                width: 92,
                height: 10,
                backgroundColor: '#80cbc4',
                borderRadius: '999px',
                marginTop: 14,
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: '-26px',
                bottom: '120px',
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85), rgba(128, 203, 196,0.52) 65%)',
                boxShadow: 'inset -3px -3px 8px rgba(255,255,255,0.6)',
                animation: 'bounceSmall 1.7s ease-in-out infinite 0.6s',
              }}
            />
          </div>

          {/* 底部破裂光泽气泡 */}
          <div
            style={{
              position: 'absolute',
              left: '6%',
              bottom: '50px',
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85), rgba(128, 203, 196,0.55) 65%)',
              boxShadow: 'inset -4px -4px 10px rgba(255,255,255,0.6)',
              animation: 'bubblePop 2.6s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: '8%',
              bottom: '80px',
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85), rgba(65, 182, 196,0.52) 65%)',
              boxShadow: 'inset -3px -3px 8px rgba(255,255,255,0.6)',
              animation: 'bubblePop 2.8s ease-in-out infinite 0.7s',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '42%',
              bottom: '130px',
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85), rgba(0, 137, 123,0.5) 65%)',
              boxShadow: 'inset -3px -3px 8px rgba(255,255,255,0.6)',
              animation: 'bubblePop 2.4s ease-in-out infinite 1.1s',
            }}
          />
        </div>
      </div>

      {/* 顶部 Header */}
      <div
        style={{
          width: '100%',
          background: isEmergency ? '#992828' : '#00897b',
          padding: '18px 36px',
          boxSizing: 'border-box',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 8px 20px rgba(0,137,123,0.18)',
          position: 'relative',
          zIndex: 2,
          transition: 'background 0.4s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              background: '#ffffff',
              padding: '10px 14px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 14px rgba(0,0,0,0.08)',
            }}
          >
            <span
              style={{
                color: '#00897b',
                fontWeight: 800,
                fontSize: '20px',
                letterSpacing: '1.2px',
                whiteSpace: 'nowrap',
              }}
            >
              SIEMENS
            </span>
          </div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '28px', fontWeight: 700, color: '#41b6c4', letterSpacing: '0.5px' }}>
                SIEMENS
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '26px', fontWeight: 700, color: '#f29222' }}>
                  Healthineers
                </span>
                <span style={{ fontSize: '22px', color: '#f29222', letterSpacing: '2px' }}>
                  ✦
                </span>
              </div>
            </div>
            <p style={{ fontSize: '14px', margin: '4px 0 0', color: '#e0f2f1' }}>
              CT Patient Prep Assistant
            </p>
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            width: '260px',
            height: '140px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '6px',
              background: 'rgba(255,255,255,0.88)',
              padding: '10px 16px',
              borderRadius: '22px',
              fontSize: '17px',
              fontWeight: 700,
              color: '#00796b',
              boxShadow: '0 8px 18px rgba(0,137,123,0.14)',
              animation: 'breathe 3s ease-in-out infinite',
            }}
          >
            Hi!
          </div>
          <div
            style={{
              position: 'absolute',
              top: '54px',
              left: '56px',
              background: 'rgba(255,255,255,0.78)',
              padding: '8px 14px',
              borderRadius: '20px',
              fontSize: '15px',
              fontWeight: 700,
              color: '#f29222',
              boxShadow: '0 8px 18px rgba(242,146,34,0.14)',
              animation: 'breathe 3.4s ease-in-out infinite',
            }}
          >
            Relax
          </div>
          <div
            style={{
              position: 'absolute',
              top: '94px',
              left: '10px',
              background: 'rgba(255,255,255,0.74)',
              padding: '8px 14px',
              borderRadius: '20px',
              fontSize: '15px',
              fontWeight: 700,
              color: '#41b6c4',
              boxShadow: '0 8px 18px rgba(65,182,196,0.14)',
              animation: 'breathe 3.8s ease-in-out infinite',
            }}
          >
            Breathe
          </div>
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: isEmergency
                ? 'rgba(239,83,80,0.92)'
                : 'rgba(255,255,255,0.94)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 16px 34px rgba(0,137,123,0.22)',
              border: '4px solid #ffffff',
              animation: 'gentleBreathe 3s ease-in-out infinite',
              zIndex: 2,
              transition: 'background 0.4s ease',
            }}
          >
            <svg
              width="82"
              height="96"
              viewBox="0 0 100 120"
              style={{ animation: 'softFloat 2.6s ease-in-out infinite', display: 'block' }}
            >
              <rect x="40" y="44" width="20" height="56" rx="10" fill="#f2c350" />
              <ellipse cx="50" cy="104" rx="26" ry="14" fill="#f2c350" />
              <ellipse cx="50" cy="30" rx="22" ry="18" fill="#f2c350" />
              <ellipse cx="28" cy="22" rx="6" ry="10" fill="#f2c350" />
              <ellipse cx="72" cy="22" rx="6" ry="10" fill="#f2c350" />
              <rect x="44" y="6" width="4" height="10" rx="2" fill="#b06a2a" />
              <rect x="52" y="6" width="4" height="10" rx="2" fill="#b06a2a" />
              <circle cx="40" cy="30" r="3" fill="#222" />
              <circle cx="60" cy="30" r="3" fill="#222" />
              <ellipse cx="50" cy="38" rx="6" ry="4" fill="#e8a83c" />
              <path d="M 42 44 Q 50 50 58 44" fill="none" stroke="#222" strokeWidth="2" strokeLinecap="round" />
              <circle cx="34" cy="54" r="4" fill="#b06a2a" />
              <circle cx="58" cy="62" r="5" fill="#b06a2a" />
              <circle cx="46" cy="78" r="4" fill="#b06a2a" />
              <circle cx="62" cy="84" r="3" fill="#b06a2a" />
              <circle cx="32" cy="96" r="3" fill="#b06a2a" />
              <circle cx="56" cy="108" r="4" fill="#b06a2a" />
              <circle cx="44" cy="24" r="3" fill="#b06a2a" />
              <circle cx="62" cy="20" r="2" fill="#b06a2a" />
            </svg>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '28px 36px',
          flex: 1,
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '28px',
            padding: '28px 32px',
            boxShadow: '0 16px 40px rgba(0,137,123,0.1)',
            border: '1px solid #eaf2ff',
            marginBottom: '24px',
          }}
        >
          <h2 style={{ fontSize: '32px', margin: '0 0 8px', color: '#0b1f3a' }}>
            Hello
          </h2>
          <p style={{ fontSize: '20px', margin: 0, color: '#4f6785', lineHeight: 1.5 }}>
            I will help you prepare for your CT scan. Press Start to begin.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '18px', marginBottom: '24px' }}>
          <button
            onClick={runSequence}
            disabled={isRunning}
            style={{
              flex: 1,
              padding: '26px 18px',
              fontSize: '22px',
              fontWeight: 600,
              color: '#ffffff',
              background: isRunning
                ? '#90cbc4'
                : 'linear-gradient(135deg, #00897b, #00bfa5)',
              border: 'none',
              borderRadius: '24px',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              boxShadow: '0 16px 34px rgba(0,150,136,0.28)',
              touchAction: 'manipulation',
              transition: 'transform 0.12s ease, box-shadow 0.12s ease',
            }}
            onTouchStart={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.transform = 'scale(0.97)';
              target.style.boxShadow = '0 8px 16px rgba(0,150,136,0.2)';
            }}
            onTouchEnd={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.transform = 'scale(1)';
              target.style.boxShadow = '0 16px 34px rgba(0,150,136,0.28)';
            }}
          >
            Start
          </button>
          <button
            onClick={handleEmergency}
            style={{
              flex: 1,
              padding: '26px 18px',
              fontSize: '22px',
              fontWeight: 600,
              color: '#ffffff',
              background: 'linear-gradient(135deg, #c62828, #ef5350)',
              border: 'none',
              borderRadius: '24px',
              cursor: 'pointer',
              boxShadow: '0 16px 34px rgba(198,40,40,0.28)',
              touchAction: 'manipulation',
              transition: 'transform 0.12s ease, box-shadow 0.12s ease',
            }}
            onTouchStart={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.transform = 'scale(0.97)';
              target.style.boxShadow = '0 8px 16px rgba(198,40,40,0.2)';
            }}
            onTouchEnd={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.transform = 'scale(1)';
              target.style.boxShadow = '0 16px 34px rgba(198,40,40,0.28)';
            }}
          >
            Emergency Call
          </button>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: '28px',
            padding: '28px',
            boxShadow: '0 16px 40px rgba(0,150,136,0.1)',
            border: '1px solid #e6f4f3',
          }}
        >
          <p style={{ fontSize: '24px', margin: '0 0 16px', color: '#004d40' }}>
            Assistant Response
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={
                  msg.role === 'patient'
                    ? {
                        alignSelf: 'flex-end',
                        background: '#e6f4f3',
                        padding: '18px 22px',
                        borderRadius: '22px 6px 22px 22px',
                        maxWidth: '75%',
                      }
                    : {
                        alignSelf: 'flex-start',
                        background: '#f4fbf9',
                        padding: '20px 24px',
                        borderRadius: '6px 22px 22px 22px',
                        maxWidth: '85%',
                        border: '1px solid #b2dfdb',
                      }
                }
              >
                <p style={{ fontSize: '20px', margin: 0, lineHeight: 1.55 }}>
                  {msg.text}
                </p>
                {msg.source && (
                  <p style={{ fontSize: '15px', margin: '12px 0 0', color: '#00796b' }}>
                    Source: {msg.source}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
