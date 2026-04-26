import Image from "next/image";
import { redirect } from "next/navigation";

import Agent from "@/components/Agent"; // ai agent thi ayu(ask , handle , record answer)


import { getRandomInterviewCover } from "@/lib/utils";

import {
  getFeedbackByInterviewId, 
  getInterviewById,                  //server action fetch interview document from Firebase
} from "@/lib/actions/general.action";

import { getCurrentUser } from "@/lib/actions/auth.action";    //server action to get logged-in user from authentication . returns id , name
import DisplayTechIcons from "@/components/DisplayTechIcons";

const InterviewDetails = async ({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ lang?: string }> }) => {
  const { id } = await params;
  const search = await searchParams;

  const user = await getCurrentUser();
  if (!user?.id) redirect("/");

  const interview = await getInterviewById(id);
  if (!interview) redirect("/");
  const lang = interview.language === "hi" || search?.lang === "hi" ? "hi" : "en";

  const feedback = await getFeedbackByInterviewId({
    interviewId: id,
    userId: user.id,
  });

  
    // Renders interview details and Agent component
  return (
    <>
      <div className="flex flex-row gap-4 justify-between">
        <div className="flex flex-row gap-4 items-center max-sm:flex-col">
          <div className="flex flex-row gap-4 items-center">
            <Image
              src={getRandomInterviewCover()}
              alt="cover-image"
              width={40}
              height={40}
              className="rounded-full object-cover size-[40px]"
            />
            <h3 className="capitalize">{interview.role} Interview</h3>
          </div>

          <DisplayTechIcons techStack={interview.techstack} />
        </div>

        <div className="flex flex-wrap gap-2 items-center justify-end">
          {interview.interviewMode === "resume" && (
            <p className="bg-primary/15 text-primary px-4 py-2 rounded-lg h-fit text-sm">
              Resume-based
            </p>
          )}
          <p className="bg-dark-200 px-4 py-2 rounded-lg h-fit">
            {interview.type}
          </p>
        </div>
      </div>

      <Agent
        userName={user.name}
        userId={user.id}
        interviewId={id}
        type="interview"
        questions={interview.questions}
        feedbackId={feedback?.id}
        language={lang}
        role={interview.role}
      />
    </>
  );
};

export default InterviewDetails;




//User visits /interview/abc123
 //     ↓
//server reads id from URL
 //     ↓
//Fetch logged-in user from firebase name,userid 
   //   ↓
//Fetch interview from fb using interview id
  //    ↓
//Fetch feedback (if exists)
    //  ↓
//Render page
      //↓
//Pass everything to Agent
     // ↓
//Agent runs voice interview
