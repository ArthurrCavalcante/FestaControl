import {
  ArrowRight,
  CalendarCheck2,
  Check,
  CircleDollarSign,
  FileCheck2,
  PackageCheck,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './Saas.module.css';

const workflow = [
  { icon: FileCheck2, title: 'Proposta', text: 'Apresente valores, condições e sua marca em um link profissional.' },
  { icon: Check, title: 'Aceite e sinal', text: 'Registre o aceite e confirme o evento somente depois do sinal.' },
  { icon: PackageCheck, title: 'Acervo reservado', text: 'Evite conflitos sabendo exatamente o que está comprometido em cada data.' },
  { icon: TrendingUp, title: 'Margem protegida', text: 'Compare receita, custos previstos e despesas reais sem planilhas paralelas.' },
];

const benefits = [
  { icon: CalendarCheck2, title: 'Operação no prazo', text: 'Agenda, retirada, montagem e devolução acompanhadas pela mesma equipe.' },
  { icon: PackageCheck, title: 'Acervo sob controle', text: 'Disponibilidade, avarias e perdas ligadas ao evento que gerou cada movimentação.' },
  { icon: CircleDollarSign, title: 'Decisão com números', text: 'Veja quanto cada festa vendeu, custou e realmente deixou de margem.' },
];

export default function ProductPage() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <main className={styles.productPage}>
      <header className={styles.publicHeader}>
        <div className={styles.publicHeaderInner}>
          <Link className={styles.publicBrand} to="/" aria-label="FestaControl — página inicial">
            <img src="/logo-icon.png" alt="" />
            <span>FestaControl</span>
          </Link>
          <nav className={styles.publicNav} aria-label="Navegação principal">
            <a href="#como-funciona">Como funciona</a>
            <a href="#produto">O produto</a>
            <a href="#beneficios">Benefícios</a>
          </nav>
          <Link className={styles.headerLogin} to="/entrar">Entrar</Link>
        </div>
      </header>

      <section className={styles.productHero}>
        <div className={styles.productHeroInner}>
          <p className={styles.eyebrow}>Gestão para empresas de decoração de festas</p>
          <h1>FestaControl</h1>
          <p className={styles.heroHeadline}>Da primeira conversa à última peça devolvida.</p>
          <p className={styles.heroDescription}>Crie propostas que ajudam a fechar, confirme o sinal, reserve o acervo e acompanhe a margem do evento em um único fluxo.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryCta} to="/entrar">Explorar demonstração <ArrowRight size={18} /></Link>
            <a className={styles.secondaryCta} href="mailto:contato@festacontrol.com.br?subject=Quero conhecer o FestaControl">Agendar uma conversa</a>
          </div>
          <div className={styles.trialLine}>
            <Check size={17} />
            <span><strong>14 dias grátis</strong> · depois, R$ 99/mês no plano fundador</span>
          </div>
        </div>
        <div className={styles.heroSignals} aria-hidden="true">
          <span><Check size={16} /> Proposta aceita</span>
          <span><CircleDollarSign size={16} /> Sinal confirmado</span>
          <span><PackageCheck size={16} /> Acervo reservado</span>
        </div>
      </section>

      <section className={styles.workflowSection} id="como-funciona">
        <div className={styles.productShell}>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionLabel}>Um fluxo, sem remendos</p>
            <h2>Do primeiro contato ao evento concluído</h2>
            <p>O trabalho avança com contexto. A proposta aceita vira a operação que movimenta o acervo e revela o resultado.</p>
          </div>
          <div className={styles.workflowGrid} style={{ '--workflow-progress': `${(activeStep + 1) * 25}%` }}>
            {workflow.map(({ icon: Icon, title, text }, index) => (
              <button
                type="button"
                className={styles.workflowItem}
                key={title}
                aria-pressed={activeStep === index}
                onClick={() => setActiveStep(index)}
                onFocus={() => setActiveStep(index)}
                onPointerEnter={() => setActiveStep(index)}
              >
                <div className={styles.workflowTopline}><span>{String(index + 1).padStart(2, '0')}</span><Icon size={22} /></div>
                <h3>{title}</h3>
                <p>{text}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.productShowcase} id="produto">
        <div className={styles.productShell}>
          <div className={styles.showcaseCopy}>
            <p className={styles.sectionLabel}>Visão comercial</p>
            <h2>Saiba onde cada evento está e qual é a próxima ação.</h2>
            <p>O pipeline reúne negociações, sinal e confirmações sem esconder o que está parado. No celular, a equipe continua com acesso rápido à agenda, operação e avisos.</p>
          </div>
          <figure className={styles.productFigure}>
            <img src="/product-pipeline.png" alt="Pipeline de eventos do FestaControl" />
            <figcaption>Ambiente demonstrativo com dados fictícios.</figcaption>
          </figure>
        </div>
      </section>

      <section className={styles.benefitsSection} id="beneficios">
        <div className={styles.productShell}>
          <div className={styles.benefitsHeading}>
            <p className={styles.sectionLabel}>Menos improviso</p>
            <h2>Seu processo inteiro falando a mesma língua.</h2>
          </div>
          <div className={styles.benefitsGrid}>
            {benefits.map(({ icon: Icon, title, text }) => (
              <div className={styles.benefit} key={title}><Icon size={23} /><h3>{title}</h3><p>{text}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.productShell}>
          <div><p className={styles.sectionLabel}>Piloto acompanhado</p><h2>Veja o FestaControl trabalhando com uma festa de verdade.</h2></div>
          <Link className={styles.primaryCta} to="/entrar">Começar demonstração <ArrowRight size={18} /></Link>
        </div>
      </section>

      <footer className={styles.productFooter}>
        <div className={styles.productShell}>
          <div className={styles.footerBrand}><img src="/logo-icon.png" alt="" /><strong>FestaControl</strong></div>
          <nav aria-label="Links legais"><a href="/privacy.html">Privacidade e LGPD</a><a href="/terms.html">Termos</a><a href="/subprocessors.html">Subprocessadores</a><a href="/acceptable-use.html">Uso do WhatsApp</a></nav>
        </div>
      </footer>
    </main>
  );
}
