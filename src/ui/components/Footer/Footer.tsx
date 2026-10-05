import { Instagram, MessageCircle, MapPin } from 'lucide-react';
import styles from './Footer.module.css';

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  // Configura tus datos aquí
  const whatsappNumber = '+542284474673'; // Reemplazar con el número real
  const instagramHandle = 'forrajeria_bas/'; // Reemplazar con el usuario real

  return (
    <footer className={styles.root}>
      <div className={styles.inner}>
        <div className={styles.grid}>
          {/* Logo & Brand */}
          <div className={styles.brandCol}>
            <div className={styles.brandRow}>
              <div className={styles.logoBox}>
                <img src="/logo.png" alt="BAS Pet Shop" className={styles.logoImg} />
              </div>
              <div>
                <h3 className={styles.brandName}>BAS Pet Shop</h3>
                <p className={styles.tagline}>"Tu mascota feliz"</p>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className={styles.contactCol}>
            <h4 className={styles.contactTitle}>Contacto</h4>
            <div className={styles.contactRow}>
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className={[styles.btn, styles.whatsappBtn].filter(Boolean).join(' ')}
              >
                <MessageCircle size={20} />
                <span>WhatsApp</span>
              </a>
              <a
                href={`https://instagram.com/${instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className={[styles.btn, styles.instagramBtn].filter(Boolean).join(' ')}
              >
                <Instagram size={20} />
                <span>Instagram</span>
              </a>
            </div>
          </div>

          {/* Location */}
          <div className={styles.locationCol}>
            <div className={styles.locationRow}>
              <MapPin size={16} />
              <span className={styles.locationText}>Buenos Aires, Argentina</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className={styles.divider}>
          <p className={styles.copy}>
            © {currentYear} BAS Pet Shop. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};
