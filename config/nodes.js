// Ten buildings. Names are EXACT per spec. Board order 1-10 = default play order.
module.exports = [
 ['judicial-center','Manatee County Judicial Center','Courts, Clerk of Court & Comptroller, court records, justice system'],
 ['elections','Manatee County Supervisor of Elections Office','Voter registration, ballots, polling places, vote-by-mail, election integrity'],
 ['gt-bray','G.T. Bray Park and Recreation Center','Parks, recreation programs, facilities, maintenance, accessibility'],
 ['school-district','School District of Manatee County Administration Building','School District/Board, superintendent, education, school funding'],
 ['sheriff',"Manatee County Sheriff's Office",'Law enforcement, public safety, investigations, emergency response'],
 ['county-admin','Manatee County Administration Building','County Commission, County Administrator, departments, budget, taxes'],
 ['library','Manatee County Central Library','Civic duties, public records, public meetings, civic engagement'],
 ['property-appraiser',"Manatee County Property Appraiser's Office",'Valuation, homestead exemptions, tax roll, millage, Appraiser vs Tax Collector'],
 ['animal-welfare','Manatee County Animal Welfare','Animal services, sheltering, adoptions, strays, fosters, funding'],
 ['public-works','Manatee County Public Works / Stormwater Operations','Flooding, stormwater, drainage, roads, infrastructure funding'],
].map(([id,name,focus],i)=>({id,name,focus,number:i+1}));
