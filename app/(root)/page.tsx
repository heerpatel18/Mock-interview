// import React from 'react'
// function page() {
//   return (
//     <div> Hello </div>
//   )
// }
// export default page


// Dashboard page displayed after user log in.
// - Fetches current user, past interviews, and latest interviews.

import Link from "next/link";  
import Image from "next/image"; 

import { Button } from "@/components/ui/button"; 
import InterviewCard from "@/components/InterviewCard"; 
import LogoutButton from "@/components/LogoutButton"; 

import { getCurrentUser } from "@/lib/actions/auth.action"; // Server action to fetch current user data from Fs
import {
  getInterviewsByUserId,
  getLatestInterviews,
} from "@/lib/actions/general.action"; // Server actions to fetch user+interview data from Fs

async function Home() {  
  const user = await getCurrentUser(); 

  const [userInterviews, allInterview] = user
    ? await Promise.all([
        getInterviewsByUserId(user.id),
        getLatestInterviews({ userId: user.id }),
      ])
    : [[], []];

  const hasPastInterviews = userInterviews && userInterviews.length > 0; 
  const hasUpcomingInterviews = allInterview && allInterview.length > 0; 

  return (
    <>
      {/* Header with user info and logout */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user?.name}!</h1>
          <p className="text-gray-600">Ready to practice your interview skills?</p>
        </div>
        <LogoutButton />
      </header>

      <section className="card-cta">
        <div className="flex flex-col gap-6 max-w-lg">
          <h2>Get Interview-Ready with AI-Powered Practice & Feedback</h2>
          <p className="text-lg">
            Practice real interview questions & get instant feedback
          </p>

          <Button asChild className="btn-primary max-sm:w-full">
            <Link href="/interview">Start an Interview</Link>
          </Button>
        </div>

        <Image
          src="/robot.png"
          alt="robo-dude"
          width={400}
          height={400}
          className="max-sm:hidden"
        />
      </section>

      <section className="flex flex-col gap-6 mt-8">
        <h2>Your Interviews</h2>

        <div className="interviews-section">
          {hasPastInterviews ? (
            userInterviews?.map((interview) => (
              <InterviewCard
                key={interview.id}
                userId={user?.id}
                interviewId={interview.id}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
                language={interview.language}
              />
            ))
          ) : (
            <p>You haven&apos;t taken any interviews yet</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-6 mt-8">
        <h2>Take an Interview</h2>

        <div className="interviews-section"> 
          {hasUpcomingInterviews ? (
            allInterview?.map((interview) => (
              <InterviewCard 
                key={interview.id}
                userId={user?.id}
                interviewId={interview.id}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
                language={interview.language}
              />
            ))
          ) : (
            <p>There are no interviews available</p>
          )}
        </div>
      </section>
    </>
  );
}

export default Home;
