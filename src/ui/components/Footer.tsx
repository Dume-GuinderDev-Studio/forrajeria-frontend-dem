import { Instagram, MessageCircle, MapPin } from 'lucide-react';

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  // Configura tus datos aquí
  const whatsappNumber = '+12343343434'; // Reemplazar con el número real
  const instagramHandle = 'forrajeria/'; // Reemplazar con el usuario real

  return (
    <footer className="bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          {/* Logo & Brand */}
          <div className="flex flex-col items-center md:items-start gap-3">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center p-1.5">
                Pet Shop
              </div>
              <div>
                <h3 className="text-xl font-bold">BAS Pet Shop</h3>
                <p className="text-slate-400 text-sm italic">"Tu mascota feliz"</p>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="flex flex-col items-center gap-4">
            <h4 className="font-semibold text-slate-300 uppercase text-sm tracking-wider">
              Contacto
            </h4>
            <div className="flex gap-4">
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 transition-colors px-4 py-2.5 rounded-lg font-medium"
              >
                <MessageCircle size={20} />
                <span>WhatsApp</span>
              </a>
              <a
                href={`https://instagram.com/${instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 transition-all px-4 py-2.5 rounded-lg font-medium"
              >
                <Instagram size={20} />
                <span>Instagram</span>
              </a>
            </div>
          </div>

          {/* Location */}
          <div className="flex flex-col items-center md:items-end gap-2 text-slate-400">
            <div className="flex items-center gap-2">
              <MapPin size={16} />
              <span className="text-sm">Buenos Aires, Argentina</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-700 mt-10 pt-6">
          <p className="text-center text-slate-500 text-sm">
            © {currentYear}Pet Shop. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};
