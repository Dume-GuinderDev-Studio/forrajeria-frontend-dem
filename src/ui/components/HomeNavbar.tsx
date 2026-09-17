import { useCartStore } from '@/infrastructure/cart_manager';
import { ShoppingCart } from 'lucide-react';

interface HomeNavbarProps {
  onOpenCart: () => void;
}

export const HomeNavbar = ({ onOpenCart }: HomeNavbarProps) => {
  const { items } = useCartStore();
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <nav className="h-20 bg-blue-700 shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-1 border-2 border-blue-400">
            PetShop
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-bold text-white leading-tight">BAS Pet Shop</h1>
            <p className="text-xs md:text-sm text-blue-100 italic font-medium">
              "Tu mascota feliz"
            </p>
          </div>
        </div>

        {/* Cart Trigger */}
        <button
          onClick={onOpenCart}
          className="relative p-2 text-white hover:bg-blue-600 rounded-lg transition-colors group"
        >
          <ShoppingCart size={28} />
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold h-5 w-5 flex items-center justify-center rounded-full animate-in zoom-in duration-300">
              {itemCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
};
