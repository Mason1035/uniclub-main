import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { AxiosError } from 'axios';
import { z } from 'zod';
import PageShell from '../components/PageShell';
import PageHeading from '../components/PageHeading';
import { Avatar } from '../components/ui/avatar';
import UserAvatarImage from '../components/UserAvatarImage';
import api from '../lib/axios';
import { randomMemberIndex } from '../lib/randomCall';
import './random-call.css';

const membersSchema = z.object({
  success: z.literal(true),
  members: z.array(z.object({ id: z.string().min(1), name: z.string().trim().min(1), avatar: z.string().nullable() })),
});
type Member = z.infer<typeof membersSchema>['members'][number];
type Phase = 'idle' | 'leaving' | 'revealing' | 'ready';
const MOTION = { exit: 180, reveal: 760 };
const motionStyle = {
  '--call-exit-duration': `${MOTION.exit}ms`,
  '--call-reveal-duration': `${MOTION.reveal}ms`,
} as CSSProperties;

export default function RandomCallPage() {
  const roster = useQuery({
    queryKey: ['random-call-members'],
    queryFn: async ({ signal }) => {
      const { data } = await api.get('/api/users/random-call-members', { signal });
      return membersSchema.parse(data).members;
    },
    retry: (failures, error) => !(error instanceof AxiosError && error.response?.status === 403) && failures < 1,
  });
  const members = roster.data ?? [];
  const [result, setResult] = useState<Member | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [drawNumber, setDrawNumber] = useState(0);
  const [drawError, setDrawError] = useState('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const locked = useRef(false);
  const repeatButton = useRef<HTMLButtonElement>(null);
  const busy = phase === 'leaving' || phase === 'revealing';
  const membershipRequired = roster.error instanceof AxiosError && roster.error.response?.status === 403;

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);
  useEffect(() => {
    if (phase === 'ready' && document.activeElement === document.body) {
      repeatButton.current?.focus({ preventScroll: true });
    }
  }, [phase]);

  const draw = () => {
    if (locked.current || !members.length) return;
    let next: Member;
    try { next = members[randomMemberIndex(members.length)]; }
    catch { setDrawError('暂时无法抽取，请重试。'); return; }
    // Determine the final member first. The motion never cycles through the pool.
    timers.current.forEach(clearTimeout);
    timers.current = [];
    locked.current = true;
    setDrawError('');
    const reveal = () => {
      setResult(next);
      setDrawNumber(number => number + 1);
      setPhase('revealing');
      timers.current.push(setTimeout(() => { setPhase('ready'); locked.current = false; }, MOTION.reveal));
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setResult(next);
      setDrawNumber(number => number + 1);
      setPhase('ready');
      locked.current = false;
    } else {
      setPhase('leaving');
      timers.current.push(setTimeout(reveal, MOTION.exit));
    }
  };

  return <PageShell className="random-call-page" style={motionStyle}>
    <PageHeading tone="editorial" title="随机点名" description="从全班成员中随机抽取一位"/>
    <section className="random-call-stage" aria-label="随机点名" aria-busy={roster.isPending || busy} data-phase={phase}>
      {roster.isPending ? <p className="random-call-message" role="status">正在准备名单…</p>
        : roster.isError ? <div className="random-call-message" role="alert"><p>{membershipRequired ? '仅当前班级成员可以使用随机点名。' : '暂时无法获取班级名单'}</p>{!membershipRequired && <button className="random-call-text-button" onClick={() => void roster.refetch()}>重新加载</button>}</div>
          : !members.length ? <p className="random-call-message">暂无可参与随机点名的班级成员。</p>
            : result ? <div className="random-call-result">
              <div className="random-call-album" key={drawNumber}>
                <div className="random-call-vinyl" aria-hidden="true"><span className="random-call-vinyl-label"><span/></span></div>
                <article className="random-call-sleeve" aria-label={`${result.name}的专辑封套`}>
                  <Avatar className="random-call-cover">
                    <UserAvatarImage src={result.avatar ? api.getUri({ url: result.avatar }) : null} identity={result.id} className="aspect-square h-full w-full" alt={`${result.name}的头像`}/>
                  </Avatar>
                  <div className="random-call-album-caption"><h2>{result.name}</h2><p>软件工程 · 3 班</p></div>
                </article>
              </div>
              <button ref={repeatButton} className="random-call-repeat" disabled={busy} onClick={draw}><RotateCcw size={23} strokeWidth={1.4} aria-hidden="true"/><span>再来一次</span></button>
            </div>
              : <button className="random-call-draw" aria-label="随机抽取一位班级成员" disabled={busy} onClick={draw}>
                <span className="random-call-object"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M13 32h37M36 18l14 14-14 14"/></svg></span><span className="random-call-draw-label">抽取</span>
              </button>}
    </section>
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{result && phase !== 'leaving' ? `本次随机抽取结果：${result.name}` : ''}</p>
    {drawError && <p className="random-call-draw-error" role="alert">{drawError}</p>}
  </PageShell>;
}
