import { CalendarCheck, FileCheck2, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import styles from './Saas.module.css';

export default function ProductPage() {
  return (
    <main>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <h1>FestaControl</h1>
          <p>Propostas profissionais, sinal, reserva do acervo e margem do evento em um só fluxo para empresas de decoração de festas.</p>
          <div className={styles.price}>R$ 99/mês · 14 dias grátis</div>
          <div className={styles.actions}>
            <Link className={styles.button} to="/entrar">Entrar</Link>
            <a className={styles.buttonSecondary} href="mailto:contato@festacontrol.com.br?subject=Quero conhecer o FestaControl">Agendar demonstração</a>
          </div>
        </div>
      </section>
      <section className={styles.band}>
        <div className={styles.shell} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 28 }}>
          <div><FileCheck2 size={28} /><h2>Feche com clareza</h2><p className={styles.muted}>Envie proposta com sua marca, valores, condições e PIX.</p></div>
          <div><CalendarCheck size={28} /><h2>Confirme com sinal</h2><p className={styles.muted}>O acervo só é reservado quando o pagamento é confirmado.</p></div>
          <div><TrendingUp size={28} /><h2>Proteja sua margem</h2><p className={styles.muted}>Compare receita, custo estimado e custo real por evento.</p></div>
        </div>
      </section>
      <footer className={styles.shell} style={{ padding: '24px 20px 48px' }}><div className={styles.actions}><a href="/privacy.html">Privacidade e LGPD</a><a href="/terms.html">Termos</a><a href="/subprocessors.html">Subprocessadores</a><a href="/acceptable-use.html">Uso do WhatsApp</a></div></footer>
    </main>
  );
}
