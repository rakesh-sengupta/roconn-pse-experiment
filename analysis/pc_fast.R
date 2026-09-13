# Power for the primary DV (drift index). No curve fitting, so this runs fast.
suppressPackageStartupMessages({library(lme4);library(lmerTest)})
set.seed(20260912)
ORD <- list(c(0,.5,1),c(0,1,.5),c(.5,0,1),c(.5,1,0),c(1,0,.5),c(1,.5,0))
one_sim <- function(delta,npc,reps=13){
  n <- npc*4*3; pid <- integer(n); topo <- direc <- P <- bo <- Dobs <- pda <- numeric(n)
  r <- 0; id <- 0
  for(tt in c(-.5,.5)) for(dd in c(-.5,.5)) for(i in 1:npc){
    id <- id+1; u0 <- rnorm(1,0,.22); u1 <- rnorm(1,0,.12)
    slope <- .12+(tt+.5)*delta+u1; ord <- ORD[[((i-1)%%6)+1]]; acc <- sample(3:7,1)
    for(b in 1:3){ r <- r+1; p <- ord[b]; D <- -.70+u0+slope*p
      p3 <- min(.98,max(.02,.5+D/2)); p5 <- min(.98,max(.02,.5-D/2))
      Dobs[r] <- rbinom(1,reps,p3)/reps - rbinom(1,reps,p5)/reps
      pid[r] <- id; topo[r] <- tt; direc[r] <- dd; P[r] <- p; bo[r] <- b; pda[r] <- acc }
  }
  data.frame(pid,topo,direc,P,bo,pda,Dobs)
}
test <- function(d){
  m <- try(suppressMessages(lmer(Dobs ~ topo*P + direc*P + topo:direc + bo + pda + (1+P|pid),
       d, REML=FALSE, control=lmerControl(optimizer="bobyqa"))), silent=TRUE)
  if(inherits(m,"try-error")) return(NA)
  s <- summary(m)$coefficients; i <- grep("^topo:P$",rownames(s))
  if(!length(i)) return(NA)
  as.numeric(s[i,"Pr(>|t|)"] < .05 && s[i,"Estimate"] > 0)
}
grid <- expand.grid(delta=c(.10,.15,.20,.25), npc=c(30,36))
NSIM <- 400
for(g in seq_len(nrow(grid))){
  h <- replicate(NSIM, test(one_sim(grid$delta[g], grid$npc[g])))
  cat(sprintf("delta=%.2f  n/cell=%2d  N=%3d  power(D)=%.3f  (nsim=%d)\n",
      grid$delta[g], grid$npc[g], grid$npc[g]*4, mean(h,na.rm=TRUE), NSIM)); flush.console()
}
