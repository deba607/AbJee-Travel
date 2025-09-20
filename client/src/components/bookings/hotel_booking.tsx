import React, { useState } from 'react';
import Header1 from '../mvpblocks/header-1';
import Footer4Col from '../mvpblocks/footer-4col';

// --- TYPE DEFINITIONS ---
interface TourPackage {
  id: number;
  image: string;
  name: string;
  duration: string;
  price: string;
  rating: number;
}

interface Testimonial {
  id: number;
  quote: string;
  name: string;
  location: string;
  avatar: string;
}

interface TourCategory {
    id: number;
    icon: React.ReactNode;
    name: string;
    description: string;
}

interface TrendingHoliday {
  id: number;
  name: string;
  image: string;
  tours: number;
  departures: number;
  guests: number;
}


// --- SVG ICONS (for simplicity, instead of a library) ---
const icons = {
  menu: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>,
  mapPin: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>,
  calendar: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>,
  briefcase: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  star: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  users: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  heart: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  award: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>,
  chevronLeft: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  chevronRight: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
};

// --- MOCK DATA ---
const tourPackages: TourPackage[] = [
  { id: 1, image: 'https://placehold.co/600x400/003366/FFFFFF?text=Europe', name: 'Spectacular Europe Adventure', duration: '10 Days / 9 Nights', price: '$2,499', rating: 5 },
  { id: 2, image: 'https://placehold.co/600x400/660066/FFFFFF?text=Japan', name: 'Cherry Blossom Season in Japan', duration: '7 Days / 6 Nights', price: '$3,199', rating: 5 },
  { id: 3, image: 'https://placehold.co/600x400/336600/FFFFFF?text=Kerala', name: 'Kerela Backwaters & Serenity', duration: '5 Days / 4 Nights', price: '$799', rating: 4 },
  { id: 4, image: 'https://placehold.co/600x400/993300/FFFFFF?text=Dubai', name: 'Dubai Extravaganza', duration: '6 Days / 5 Nights', price: '$1,899', rating: 5 },
];

const testimonials: Testimonial[] = [
  { id: 1, quote: "The Europe trip was a dream come true! ABjee's planning was meticulous, and our tour manager was fantastic. Highly recommended!", name: 'Rohan Sharma', location: 'Mumbai, India', avatar: 'https://placehold.co/100x100/EFEFEF/333333?text=RS' },
  { id: 2, quote: "Our family had an unforgettable time in Kerala. The houseboat experience was the highlight. Everything was seamless, from booking to the final day.", name: 'Priya Patel', location: 'Ahmedabad, India', avatar: 'https://placehold.co/100x100/EFEFEF/333333?text=PP' },
  { id: 3, quote: "I've traveled with many agencies, but the professionalism and personal touch from ABjee are unmatched. The Japan tour was perfectly paced.", name: 'Anjali Desai', location: 'Pune, India', avatar: 'https://placehold.co/100x100/EFEFEF/333333?text=AD' },
];

const tourCategories: TourCategory[] = [
    { id: 1, icon: icons.users, name: 'Group Tours', description: 'Join fellow travelers for an exciting journey.' },
    { id: 2, icon: icons.heart, name: 'Honeymoon', description: 'Create romantic memories that last a lifetime.' },
    { id: 3, icon: icons.briefcase, name: 'Corporate Tours', description: 'Team building and leisure for your company.' },
    { id: 4, icon: icons.award, name: 'Specialty Tours', description: 'Unique experiences tailored to your interests.' },
];

const trendingHolidays: TrendingHoliday[] = [
    { id: 1, name: 'Andaman', image: 'https://placehold.co/400x300/0D9488/FFFFFF?text=Andaman', tours: 5, departures: 156, guests: 27951 },
    { id: 2, name: 'Kashmir', image: 'https://placehold.co/400x300/3B82F6/FFFFFF?text=Kashmir', tours: 13, departures: 99, guests: 130148 },
    { id: 3, name: 'Himachal', image: 'https://placehold.co/400x300/6366F1/FFFFFF?text=Himachal', tours: 16, departures: 160, guests: 212000 },
    { id: 4, name: 'North East', image: 'https://placehold.co/400x300/16A34A/FFFFFF?text=North+East', tours: 4, departures: 77, guests: 4397 },
    { id: 5, name: 'Sikkim Darjeeling', image: 'https://placehold.co/400x300/0891B2/FFFFFF?text=Sikkim', tours: 6, departures: 54, guests: 29599 },
    { id: 6, name: 'Leh Ladakh', image: 'https://placehold.co/400x300/CA8A04/FFFFFF?text=Ladakh', tours: 2, departures: 2, guests: 22979 },
    { id: 7, name: 'Africa', image: 'https://placehold.co/400x300/D97706/FFFFFF?text=Africa', tours: 3, departures: 8, guests: 3523 },
    { id: 8, name: 'America', image: 'https://placehold.co/400x300/4F46E5/FFFFFF?text=America', tours: 6, departures: 6, guests: 18321 },
    { id: 9, name: 'Dubai and MiddleEast', image: 'https://placehold.co/400x300/57534E/FFFFFF?text=Dubai', tours: 11, departures: 137, guests: 45661 },
    { id: 10, name: 'Nepal', image: 'https://placehold.co/400x300/BE185D/FFFFFF?text=Nepal', tours: 3, departures: 37, guests: 11997 },
    { id: 11, name: 'South East Asia', image: 'https://placehold.co/400x300/047857/FFFFFF?text=Asia', tours: 29, departures: 318, guests: 221189 },
    { id: 12, name: 'Europe', image: 'https://placehold.co/400x300/7C3AED/FFFFFF?text=Europe', tours: 15, departures: 40, guests: 124383 },
];


// --- MAIN BOOKINGS COMPONENT ---
export default function HotelBookings() {
  
  
  
  const [currentIndex, setCurrentIndex] = useState(0);

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="bg-white font-sans">
      {/* Header */}
      <Header1/>

      <main className="pt-20 md:pt-28">
        {/* Hero Section */}
        <section className="w-full">
        <video
          src="/video1.mp4" //add video link here..
          className="w-full h-[60vw] max-h-[600px] object-cover pt-2"
          autoPlay
          loop
          muted
          // controls
        >
          
        </video>
      </section>

        {/* Tour Categories Section */}
        <section className="py-16 bg-white">
            <div className="container mx-auto px-4">
                 <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-gray-800">Explore Tour Types</h2>
                    <p className="text-gray-600 mt-2">Find the perfect journey that fits your style.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {tourCategories.map(category => (
                        <div key={category.id} className="text-center p-6 border rounded-lg hover:shadow-xl hover:border-rose-500 transition-all duration-300">
                           <div className="flex items-center justify-center h-16 w-16 mx-auto bg-fuchsia-100 text-fuchsia-600 rounded-full mb-4">
                             {category.icon}
                           </div>
                           <h3 className="text-xl font-bold text-gray-800 mb-2">{category.name}</h3>
                           <p className="text-gray-600">{category.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* Popular Tours Section */}
        <section className="py-16 bg-gray-50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-gray-800">Our Most Popular Tours</h2>
                    <p className="text-gray-600 mt-2">Handpicked destinations by our travel experts.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {tourPackages.map(tour => (
                      <div key={tour.id} className="bg-white rounded-lg shadow-lg overflow-hidden transform hover:-translate-y-2 transition-transform duration-300 group">
                          <div className="relative">
                              <img src={tour.image} alt={tour.name} className="w-full h-56 object-cover" />
                              <div className="absolute top-4 left-4 bg-rose-500 text-white text-xs font-bold px-3 py-1 rounded-full">{tour.duration}</div>
                          </div>
                          <div className="p-6">
                              <h3 className="text-xl font-bold text-gray-800 mb-2 h-14">{tour.name}</h3>
                              <div className="flex justify-between items-center mb-4">
                                  <div className="flex items-center">
                                      {Array.from({ length: 5 }).map((_, i) => (
                                          <span key={i} className={i < tour.rating ? 'text-yellow-400' : 'text-gray-300'}>{icons.star}</span>
                                      ))}
                                  </div>
                                  <span className="text-2xl font-bold text-fuchsia-600">{tour.price}</span>
                              </div>
                               <button className="w-full bg-fuchsia-600 text-white font-bold py-2 rounded-md hover:bg-fuchsia-700 transition duration-300 group-hover:bg-rose-500">View Details</button>
                          </div>
                      </div>
                    ))}
                </div>
            </div>
        </section>

         {/* Trending Group Holidays Section */}
        <section className="py-16 bg-white">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-gray-800">Trending Group Holidays</h2>
                    <p className="text-gray-600 mt-2">Discover iconic destinations across India and the world with our group tours!</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {trendingHolidays.map(holiday => (
                        <div key={holiday.id} className="relative rounded-lg overflow-hidden h-48 text-white group shadow-lg cursor-pointer">
                            <img src={holiday.image} alt={holiday.name} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-3">
                                <h3 className="font-bold text-base md:text-lg whitespace-nowrap overflow-hidden text-ellipsis">{holiday.name}</h3>
                                <div className="text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 max-h-0 group-hover:max-h-20 overflow-hidden">
                                    <p>{holiday.tours} Tours</p>
                                    <p>{holiday.departures} Departures</p>
                                    <p>{holiday.guests} Guests</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-16 bg-fuchsia-50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-gray-800">What Our Guests Say</h2>
                    <p className="text-gray-600 mt-2">Stories from our happy and satisfied travelers.</p>
                </div>
                <div className="relative max-w-3xl mx-auto">
                    <div className="overflow-hidden">
                        <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                            {testimonials.map(t => (
                                <div key={t.id} className="w-full flex-shrink-0 text-center px-8">
                                    <img src={t.avatar} alt={t.name} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-white shadow-lg" />
                                    <p className="text-lg italic text-gray-700 mb-4">"{t.quote}"</p>
                                    <h4 className="font-bold text-fuchsia-600">{t.name}</h4>
                                    <p className="text-sm text-gray-500">{t.location}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                     <button onClick={prevTestimonial} className="absolute top-1/2 -translate-y-1/2 left-0 -translate-x-1/2 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100">
                        {icons.chevronLeft}
                    </button>
                    <button onClick={nextTestimonial} className="absolute top-1/2 -translate-y-1/2 right-0 translate-x-1/2 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100">
                        {icons.chevronRight}
                    </button>
                </div>
            </div>
        </section>
      </main>

      {/* Footer */}
      <Footer4Col/>
    </div>
  );
}

