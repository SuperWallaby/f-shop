import RevealTrigger from "../hook/Reaveal";
import ChatBubbleOvalLeftIcon from "@heroicons/react/24/outline/ChatBubbleOvalLeftIcon";

const ReviewSection = () => {
 const reviews = [
  {
   highlight: "Focused, guided strengthening",
   role: "Medical Doctor",
   body: (
    <>
     Joined Faséa Pilates to{" "}
     <span className="font-semibold text-[#A66A4A]">
      strengthen my muscles and abdominal core
     </span>
     .
     <br />
     <br />
     Sha carefully corrects each movement so we do the exercises the{" "}
     <span className="font-semibold text-[#A66A4A]">right way</span> and get
     real results.
     <br />
     <br />
     At first everything felt sore, but with consistency my body adapted and now
     I feel much more comfortable and happy in class.
    </>
   ),
   bodyPlain:
    "Joined Faséa Pilates to strengthen my muscles and abdominal core. Sha carefully corrects each movement so we do the exercises the right way and get real results. At first everything felt sore, but with consistency my body adapted and now I feel much more comfortable and happy in class.",
  },
  {
   highlight: "Less back pain, better posture",
   role: "Speech Therapist",
   body: (
    <>
     After class I sometimes feel a{" "}
     <span className="font-semibold text-[#A66A4A]">good kind of soreness</span>
     , but it is not as painful as doing pilates on my own.
     <br />
     <br />
     The instructor is{" "}
     <span className="font-semibold text-[#A66A4A]">
      very supportive and helpful
     </span>
     , and after class I notice{" "}
     <span className="font-semibold text-[#A66A4A]">
      less back pain and better posture
     </span>
     .
    </>
   ),
   bodyPlain:
    "After class I sometimes feel a good kind of soreness, but it is not as painful as doing pilates on my own. The instructor is very supportive and helpful, and after class I notice less back pain and better posture.",
  },
  {
   highlight: "Came once, stayed for the package",
   role: "Dentist",
   body: (
    <>
     This is my 3rd time joining Faséa Pilates and it has been{" "}
     <span className="font-semibold text-[#A66A4A]">the best experience</span>.
     <br />
     <br />
     Fasha teaches and corrects{" "}
     <span className="font-semibold text-[#A66A4A]">
      the right pilates positions
     </span>{" "}
     so every class feels effective.
     <br />
     <br />I first came just to try one class, but I{" "}
     <span className="font-semibold text-[#A66A4A]">
      immediately joined the package
     </span>{" "}
     because I enjoyed it so much.
    </>
   ),
   bodyPlain:
    "This is my 3rd time joining Faséa Pilates and it has been the best experience. Fasha teaches and corrects the right pilates positions so every class feels effective. I first came just to try one class, but I immediately joined the package because I enjoyed it so much.",
  },
 ];

 const reviewLdJson = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Faséa Pilates",
  review: reviews.map((review) => {
   return {
    "@type": "Review",
    reviewBody: review.bodyPlain,
    name: review.highlight,
    author: {
     "@type": "Person",
     jobTitle: review.role,
    },
    reviewRating: {
     "@type": "Rating",
     ratingValue: "5",
     bestRating: "5",
    },
   };
  }),
 };

 return (
  <section id="Review" className="py-24 px-6 bg-[#FAF8F6] text-[#444444]">
   <RevealTrigger rootSelector="#Review" />
   <div className="max-w-5xl mx-auto text-center mb-12">
    <h3 className="font-serif text-3xl sm:text-4xl font-bold">
     What Clients Are Saying
    </h3>
    <p className="text-[#716D64] text-base sm:text-xl mt-4 font-medium">
     Stories from clients who felt stronger, clearer, and more at ease.
    </p>
   </div>
   <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
    {reviews.map((review, index) => (
     <article
      key={index}
      className="reveal bg-white/70 backdrop-blur-md border border-[#E8DDD4] rounded-3xl p-6 text-left shadow-sm hover:shadow-md transition duration-300"
     >
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F3ECE6]">
       <ChatBubbleOvalLeftIcon
        strokeWidth={2}
        className="h-5 w-5 text-[#C49A86]"
       />
      </div>
      <h4 className="font-serif text-lg font-semibold mb-1 text-[#A66A4A]">
       {review.highlight}
      </h4>
      <p className="text-xs uppercase tracking-wide text-[#9B9B7B] mb-3">
       {review.role}
      </p>
      <div className="text-sm leading-[1.75] text-[#5C574F]">{review.body}</div>
     </article>
    ))}
   </div>
   <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewLdJson) }}
   />
  </section>
 );
};

export default ReviewSection;
