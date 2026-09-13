# Sensitivity of the three candidate DVs to the same simulated drift.
suppressPackageStartupMessages({library(lme4);library(lmerTest)})
set.seed(20260913)
G <- 0.5; L <- 0.02
curve <- function(x,pse,k) G + (1-G-L)/(1+exp(-k*(x-pse)))
fitb <- function(kk){
  nll <- function(par){p <- curve(2:6,par[1],exp(par[2])); p <- pmin(pmax(p,1e-9),1-1e-9)
    -sum(kk*log(p)+(13-kk)*log(1-p))}
  f <- tryCatch(optim(c(4,0),nll,control=list(maxit=1500)),error=function(e)NULL)
  if(is.null(f)||f$convergence!=0) c(NA,NA) else c(f$par[1],exp(f$par[2]))
}
ORD <- list(c(0,.5,1),c(0,1,.5),c(.5,0,1),c(.5,1,0),c(1,0,.5),c(1,.5,0))
one <- function(delta,npc=30){
  n <- npc*4*3; out <- data.frame(pid=integer(n),topo=numeric(n),direc=numeric(n),
    P=numeric(n),bo=numeric(n),pda=numeric(n),Dobs=numeric(n),PSE=numeric(n),JND=numeric(n))
  r <- 0; id <- 0
  for(tt in c(-.5,.5)) for(dd in c(-.5,.5)) for(i in 1:npc){
    id <- id+1; u0 <- rnorm(1,0,.22); u1 <- rnorm(1,0,.12)
    sl <- .12+(tt+.5)*delta+u1; ord <- ORD[[((i-1)%%6)+1]]; acc <- sample(3:7,1)
    for(b in 1:3){ r <- r+1; p <- ord[b]; D <- -.70+u0+sl*p
      p3 <- min(.98,max(.02,.5+D/2)); p5 <- min(.98,max(.02,.5-D/2))
      k <- rbinom(5,13,c(.10,p3,.50,p5,.90)); f <- fitb(k)
      out[r,] <- list(id,tt,dd,p,b,acc,k[2]/13-k[4]/13,f[1],1/f[2]) }
  }
  out
}
test <- function(d,dv){
  m <- try(suppressMessages(lmer(as.formula(paste(dv,"~ topo*P + direc*P + topo:direc + bo + pda + (1+P|pid)")),
       d,REML=FALSE,control=lmerControl(optimizer="bobyqa"))),silent=TRUE)
  if(inherits(m,"try-error")) return(NA)
  s <- summary(m)$coefficients; i <- grep("^topo:P$",rownames(s))
  if(!length(i)) return(NA); as.numeric(s[i,"Pr(>|t|)"]<.05 && s[i,"Estimate"]>0)
}
NS <- 150; hD <- hP <- hJ <- numeric(0)
for(s in 1:NS){ d <- one(0.15); dv <- d[!is.na(d$PSE) & d$PSE>1 & d$PSE<7,]
  hD <- c(hD,test(d,"Dobs")); hP <- c(hP,test(dv,"PSE")); hJ <- c(hJ,test(dv,"JND")) }
cat(sprintf("delta=0.15 N=120 nsim=%d  power: D=%.3f  PSE=%.3f  JND=%.3f\n",
    NS,mean(hD,na.rm=TRUE),mean(hP,na.rm=TRUE),mean(hJ,na.rm=TRUE)))
