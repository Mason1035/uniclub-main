import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { Slider } from '../../../components/ui/slider';
import { Switch } from '../../../components/ui/switch';
import { usePet } from '../PetContext';
import { PET_ACTIONS, type ClassHubPetConfigStore } from '../pet-config';
import { PET_SKINS } from '../pet-skins';
import type { PetAction, PetConfig } from '../types';
import ConfirmationDialog from '../../../components/ui/ConfirmationDialog';
import { clearPetPosition } from '../pet-storage';

const ACTION_LABELS: Record<PetAction, string> = {
  signature: '角色招牌动作', fly: '飞行', dance: '摇摆舞', spin: '转圈', hops: '连跳',
  roll: '翻滚', breach: '跃出水面', sway: '摇摆', random: '随机动作',
};

function SettingsControls({ store, sectionNumber }: { store: ClassHubPetConfigStore; sectionNumber?: string }) {
  const { config, available, status, error } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const { pet } = usePet();
  const section = useRef<HTMLElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === '#pet-settings') { section.current?.scrollIntoView({ block: 'start' }); section.current?.focus({ preventScroll: true }); }
  }, [hash]);
  const range = (key: 'petSize' | 'petOpacity' | 'petVolume' | 'petHue', label: string, min: number, max: number, unit: string) => {
    const value = key === 'petOpacity' ? Math.round(config[key] * 100) : config[key];
    const id = `pet-${key}`;
    return <div className="pet-setting-range" key={key}>
      <div className="flex justify-between items-center gap-3 mb-4"><label id={`${id}-label`}>{label}</label><output>{value}{unit}</output></div>
      <Slider data-pet-avoid id={id} aria-labelledby={`${id}-label`} disabled={!available} min={min} max={max} step={1} value={[value]}
        onValueChange={values => store.update({ [key]: key === 'petOpacity' ? values[0] / 100 : values[0] })}/>
      <div className="flex justify-between text-xs text-muted-foreground mt-3"><span>{min}{unit}</span><span>{max}{unit}</span></div>
    </div>;
  };
  const toggle = (key: 'petMuted' | 'petTalkative' | 'petWalkable' | 'petInteractive' | 'petPageMessages', label: string, description: string) => <div className="pet-setting-toggle" key={key}>
    <div><label htmlFor={`pet-${key}`} className="font-semibold">{label}</label><p className="text-sm text-muted-foreground mt-1">{description}</p></div>
    <Switch id={`pet-${key}`} checked={config[key]} disabled={!available} onCheckedChange={value => store.update({ [key]: value })}/>
  </div>;
  const actionSelect = (key: 'petPokeAction' | 'petCelebrateAction', label: string) => <div className="pet-setting-range">
    <label htmlFor={`pet-${key}`} className="block mb-3">{label}</label>
    <select id={`pet-${key}`} className="pet-select" value={config[key]} disabled={!available}
      onChange={event => store.update({ [key]: event.target.value as PetConfig[typeof key] })}>
      {PET_ACTIONS.map(action => <option key={action} value={action}>{ACTION_LABELS[action]}</option>)}
    </select>
  </div>;

  return <section ref={section} id="pet-settings" tabIndex={-1} className="pet-settings mb-8" aria-labelledby="pet-settings-title">
    <div className="pet-settings-heading"><h2 id="pet-settings-title" className="text-xl font-bold">{sectionNumber && <span className="account-section-number mr-3" aria-hidden="true">{sectionNumber}</span>}桌宠设置</h2>
      <p className="text-sm text-muted-foreground mt-2">给班级生活添一位小伙伴。右下角的桌宠会随设置实时变化。</p></div>
    <div className="pet-setting-toggle border-b border-border">
      <div><label htmlFor="pet-enabled" className="font-semibold">启用桌宠</label><p className="text-sm text-muted-foreground mt-1">登录后陪伴你浏览班级页面。</p></div>
      <Switch id="pet-enabled" checked={config.petEnabled} disabled={!available} onCheckedChange={value => store.update({ petEnabled: value })}/>
    </div>
    <div className="pet-setting-range border-b border-border">
      <label htmlFor="pet-skin" className="block font-semibold mb-3">角色 / 皮肤</label>
      <select id="pet-skin" className="pet-select" value={config.petSkin} disabled={!available} onChange={event => store.update({ petSkin: event.target.value })}>
        {PET_SKINS.map(skin => <option key={skin.id} value={skin.id}>{skin.name}</option>)}
      </select>
    </div>
    <div className="pet-settings-grid">
      {range('petSize', '桌宠大小', 72, 200, 'px')}
      {range('petOpacity', '透明度', 20, 100, '%')}
      {range('petVolume', '音量', 0, 100, '%')}
      {range('petHue', '色相', 0, 360, '°')}
    </div>
    <div className="border-y border-border">
      {toggle('petMuted', '静音', '保留互动和动画，关闭声音。')}
      {toggle('petTalkative', '显示气泡', '看看小伙伴想说什么。')}
      {toggle('petWalkable', '允许桌宠走动', '闲置时在屏幕下方散步。')}
      {toggle('petInteractive', '允许点击互动', '点击或按回车时回应你；拖拽始终可用。')}
      {toggle('petPageMessages', '页面消息提醒', '允许业务事件通过桌宠显示消息，供后续联动使用。')}
    </div>
    <div className="pet-settings-grid">{actionSelect('petPokeAction', '点击互动动作')}{actionSelect('petCelebrateAction', '庆祝动作')}</div>
    <div className="pet-setting-range"><label htmlFor="pet-activity" className="block mb-3">互动频率</label><select id="pet-activity" className="pet-select" value={config.petActivity} disabled={!available} onChange={e => store.update({ petActivity: e.target.value as PetConfig['petActivity'] })}><option value="quiet">安静</option><option value="normal">正常</option><option value="active">活泼</option></select><p className="text-xs text-muted-foreground mt-3">影响随机动作和气泡的间隔，从下一次调度起生效；不会自动播放音效。</p></div>
    <p className="text-sm text-muted-foreground mb-4">手机会自动缩小桌宠并避开导航；长按可打开菜单。</p>
    <div className="flex gap-3 flex-wrap">
      <button type="button" className="ed-button secondary" disabled={!available || !config.petEnabled || !config.petInteractive} onClick={() => pet.poke()}>互动一下</button>
      <button type="button" className="ed-button secondary" disabled={!available || !config.petEnabled} onClick={() => pet.celebrate()}>看看庆祝动作</button>
      <button type="button" className="ed-button secondary" disabled={!available} onClick={() => { clearPetPosition(store.userId); pet.resetPosition(); }}>重置桌宠位置</button>
      <button type="button" className="ed-button secondary" disabled={!available} onClick={() => setConfirmReset(true)}>恢复桌宠默认设置</button>
    </div>
    <p role="status" className={`text-sm mt-4 ${error ? 'text-destructive' : 'text-muted-foreground'}`}>
      {error || (status === 'loading' ? '正在加载桌宠设置…' : status === 'saving' ? '正在保存…' : '设置已同步到账号。')}
      {error && <button type="button" className="text-link ml-3 min-h-11" onClick={store.retry}>重试</button>}
    </p>
    <ConfirmationDialog isOpen={confirmReset} onClose={() => setConfirmReset(false)} onConfirm={() => { store.reset(); setConfirmReset(false); }} title="恢复桌宠默认设置" message="确定恢复桌宠默认设置吗？仅重置桌宠偏好，不影响外观、通知、邮箱或个人资料。" confirmText="恢复默认" type="info"/>
  </section>;
}

export default function PetSettings({ sectionNumber }: { sectionNumber?: string }) {
  const { store } = usePet();
  return store ? <SettingsControls key={store.userId} store={store} sectionNumber={sectionNumber}/> : null;
}
